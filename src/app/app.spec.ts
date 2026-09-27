import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';
import { MenuService } from './core/services/menu.service';
import { SettingsService } from './core/services/settings.service';
import { HawkerApiService } from './core/services/hawker-api.service';
import { OrderApiService } from './core/services/order-api.service';
import { AuthTokenService } from './core/services/auth-token.service';
import { OrderService } from './core/services/order.service';

describe('OrderApiService authorization', () => {
  let orderApi: OrderApiService;
  let authToken: AuthTokenService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    orderApi = TestBed.inject(OrderApiService);
    authToken = TestBed.inject(AuthTokenService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('accessToken');
  });

  it('should send the current Cognito access token, not one saved at login', async () => {
    localStorage.setItem('accessToken', 'expired-token-saved-at-login');
    vi.spyOn(authToken, 'getAccessToken').mockResolvedValue('fresh-token');

    const pending = orderApi.getStallOrders(1);
    const req = await vi.waitFor(() => httpMock.expectOne(r => r.url.endsWith('/v1/order/stalls/1/orders')));
    req.flush({ orders: [] });
    await pending;

    expect(req.request.headers.get('Authorization')).toBe('Bearer fresh-token');
  });

  it('should send no Authorization header when nobody is signed in, even if an old token lingers', async () => {
    localStorage.setItem('accessToken', 'token-from-a-signed-out-session');
    vi.spyOn(authToken, 'getAccessToken').mockResolvedValue(null);

    const pending = orderApi.getStallOrders(1);
    const req = await vi.waitFor(() => httpMock.expectOne(r => r.url.endsWith('/v1/order/stalls/1/orders')));
    req.flush({ orders: [] });
    await pending;

    expect(req.request.headers.has('Authorization')).toBe(false);
  });
});

describe('OrderService status sync', () => {
  let orderService: OrderService;
  let stallStatusCalls: string[];
  let releaseNext: Map<string, Array<(ok: boolean) => void>>;

  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
  const release = async (orderNumber: string, ok = true) => {
    releaseNext.get(orderNumber)!.shift()!(ok);
    await settle();
  };
  const order = (id: string, backendOrderId: number) =>
    ({ id, backendOrderId, stallId: 1, orderNumber: `HF-${backendOrderId}`, status: 'pending', items: [] }) as any;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()]
    });
    const api = TestBed.inject(OrderApiService);
    stallStatusCalls = [];
    releaseNext = new Map();
    // Each stall-status PATCH stays in flight until the test releases it.
    vi.spyOn(api, 'updateStallOrderStatus').mockImplementation((_stallId, backendOrderId, status) => {
      stallStatusCalls.push(`HF-${backendOrderId}:${status}`);
      return new Promise((resolve, reject) => {
        const queue = releaseNext.get(`HF-${backendOrderId}`) ?? [];
        queue.push(ok => (ok ? resolve({}) : reject(new Error('502 Bad Gateway'))));
        releaseNext.set(`HF-${backendOrderId}`, queue);
      });
    });
    vi.spyOn(api, 'updateOrderStatus').mockResolvedValue({});
    orderService = TestBed.inject(OrderService);
  });

  it("should send an order's status changes to the backend one at a time, in click order", async () => {
    orderService.orders.set([order('o-110', 110)]);

    orderService.updateOrderStatus('o-110', 'preparing');
    orderService.updateOrderStatus('o-110', 'ready');
    orderService.updateOrderStatus('o-110', 'completed');
    await settle();

    // The screen moves on at once; the backend hears one change at a time.
    expect(orderService.orders()[0].status).toBe('completed');
    expect(stallStatusCalls).toEqual(['HF-110:PREPARING']);

    await release('HF-110');
    expect(stallStatusCalls).toEqual(['HF-110:PREPARING', 'HF-110:READY']);

    await release('HF-110');
    expect(stallStatusCalls).toEqual(['HF-110:PREPARING', 'HF-110:READY', 'HF-110:COMPLETED']);
  });

  it('should still send the next status change after one fails', async () => {
    orderService.orders.set([order('o-110', 110)]);

    orderService.updateOrderStatus('o-110', 'preparing');
    orderService.updateOrderStatus('o-110', 'ready');
    await settle();
    await release('HF-110', false);

    expect(stallStatusCalls).toEqual(['HF-110:PREPARING', 'HF-110:READY']);
  });

  it('should keep a status the hawker just set when a pending-orders poll still lists the order as pending', async () => {
    const api = TestBed.inject(OrderApiService);
    vi.spyOn(TestBed.inject(AuthService), 'currentStall').mockReturnValue({ id: 'stall-1', numericId: 1 } as any);
    const pendingDto = (orderId: number) => ({
      stall_order_id: orderId, order_id: orderId, stall_id: 1, status: 'PENDING',
      subtotal: 4.5, created_at: '2026-09-27T09:00:00', items: []
    });
    // Two diners' orders arrive together
    vi.spyOn(api, 'getMyStallOrders').mockResolvedValue({ stall_id: 1, orders: [pendingDto(120), pendingDto(121)] } as any);
    await orderService.pollPendingOrders();
    const idOf = (backendOrderId: number) => orderService.orders().find(o => o.backendOrderId === backendOrderId)!.id;

    // The hawker starts cooking order 120; its PATCH is still in flight...
    orderService.updateOrderStatus(idOf(120), 'preparing');
    // ...when a poll fetched before the PATCH landed still lists both orders as pending.
    await orderService.pollPendingOrders();

    const byBackendId = (id: number) => orderService.orders().find(o => o.backendOrderId === id)!;
    expect(byBackendId(120).status).toBe('preparing');
    expect(byBackendId(120).startedPrepAt).toBeDefined();
    expect(byBackendId(121).status).toBe('pending');
  });

  it('should not hold up one order behind another', async () => {
    orderService.orders.set([order('o-110', 110), order('o-111', 111)]);

    orderService.updateOrderStatus('o-110', 'preparing');
    orderService.updateOrderStatus('o-111', 'preparing');
    await settle();

    expect(stallStatusCalls).toEqual(['HF-110:PREPARING', 'HF-111:PREPARING']);
  });
});

describe('OrderService dining option and counter orders', () => {
  let orderService: OrderService;
  let api: OrderApiService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()]
    });
    api = TestBed.inject(OrderApiService);
    vi.spyOn(TestBed.inject(AuthService), 'currentStall').mockReturnValue({ id: 'stall-1', numericId: 1 } as any);
    orderService = TestBed.inject(OrderService);
  });

  it('should show a diner takeaway order as takeaway, and one without an option as dine-in', async () => {
    const dto = (orderId: number, extra: object = {}) => ({
      stall_order_id: orderId, order_id: orderId, stall_id: 1, status: 'PENDING',
      subtotal: 4.5, created_at: '2026-09-27T12:00:00', items: [], ...extra
    });
    vi.spyOn(api, 'getMyStallOrders').mockResolvedValue({
      stall_id: 1, orders: [dto(130, { dining_option: 'takeaway' }), dto(131)]
    } as any);

    await orderService.pollPendingOrders();

    const byId = (id: number) => orderService.orders().find(o => o.backendOrderId === id)!;
    expect(byId(130).diningOption).toBe('takeaway');
    expect(byId(131).diningOption).toBe('dine_in');
  });

  it('should send a counter takeaway order with dish names, its dining option and fee', async () => {
    const submitSpy = vi.spyOn(api, 'submitOrder').mockResolvedValue({ order_id: 140 });
    TestBed.inject(SettingsService).settings.set({ enableTakeawayFee: true, takeawayFeeAmount: 0.3, enableGst: false, gstRate: 0 } as any);
    orderService.cartItems.set([{
      id: 'c1', menuItemId: 'm1', dishId: 1, name: 'Steamed Chicken Rice', basePrice: 4.5,
      quantity: 1, selectedModifiers: [], unitPriceWithModifiers: 4.5, totalPrice: 4.5
    } as any]);
    orderService.diningOption.set('takeaway');

    await orderService.submitOrder('cash', 10);

    const sent = submitSpy.mock.calls[0][0];
    expect(sent.orders[0].dishes[0].dish_name).toBe('Steamed Chicken Rice');
    expect(sent.dining_option).toBe('takeaway');
    expect(sent.takeaway_fee).toBe(0.3);
    expect(orderService.orders()[0].backendOrderId).toBe(140);
  });
});

describe('HawkerFlow App & Multi-Stall System', () => {
  let authService: AuthService;
  let menuService: MenuService;
  let settingsService: SettingsService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideHttpClient()
      ]
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    menuService = TestBed.inject(MenuService);
    settingsService = TestBed.inject(SettingsService);
    router = TestBed.inject(Router);
  });

  it('should create the app shell', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should register and switch stalls seamlessly', () => {
    const newStall = authService.registerStall({
      stallName: 'Golden Wok Noodles',
      hawkerCentreName: 'Maxwell Food Centre',
      unitNumber: '#01-10',
      uenNumber: '202488888M',
      contactNumber: '+65 9888 1234',
      ownerName: 'Chef Tan',
      email: 'goldenwok@maxwell.sg',
      password: 'password123',
      emoji: '🍜',
      cuisineCategory: 'Noodles & Wok',
      settings: {} as any
    });

    expect(authService.isAuthenticated()).toBe(true);
    expect(authService.currentStall()?.stallName).toBe('Golden Wok Noodles');
  });


  it('should register a brand new hawker stall and allow custom menu editing', () => {
    const newStall = authService.registerStall({
      stallName: 'Marina Bay Satay Club',
      hawkerCentreName: 'Lau Pa Sat',
      unitNumber: '#01-10',
      uenNumber: '202488888M',
      contactNumber: '+65 9888 1234',
      ownerName: 'Chef Zul',
      email: 'marinabay@laupasat.sg',
      password: 'password123',
      emoji: '🍢',
      cuisineCategory: 'Satay & BBQ',
      settings: {} as any
    });

    expect(newStall.id).toBeDefined();
    expect(authService.currentStall()?.id).toBe(newStall.id);
    expect(authService.currentStall()?.stallName).toBe('Marina Bay Satay Club');

    // Add a custom item to this stall's menu
    menuService.addItem({
      id: 'satay-combo',
      name: 'Mutton & Chicken Satay Set (10 Sticks)',
      chineseName: '沙爹套餐',
      description: 'Served with homemade peanut gravy and ketupat.',
      categoryId: 'mains',
      basePrice: 12.00,
      emoji: '🍢',
      isAvailable: true,
      popularBadge: 'Popular',
      preparationTimeMins: 5
    });

    const items = menuService.items();
    expect(items.some(i => i.name.includes('Satay Set'))).toBe(true);
  });

  it('should log out and clear session', () => {
    authService.logout();
    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.currentSession()).toBeNull();
  });

  it('should remove a leftover access token from localStorage on logout', async () => {
    localStorage.setItem('accessToken', 'token-from-an-earlier-login');

    await authService.logout();

    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('should register a hawker stall with the correct backend payload structure', async () => {
    const hawkerApiService = TestBed.inject(HawkerApiService);
    let capturedPayload: any = null;
    vi.spyOn(hawkerApiService, 'registerHawker').mockImplementation(async (payload) => {
      capturedPayload = payload;
      return { success: true, stall_id: 99 };
    });

    const result = await authService.registerHawkerStall({
      username: 'ahhuat88',
      stallName: 'Ah Huat Hainanese Chicken Rice',
      hawkerCentreName: 'Maxwell Food Centre',
      unitNumber: '#01-56',
      stallDescription: 'Famous traditional steamed & roasted chicken rice',
      contactNumber: '+65 9123 4567',
      ownerName: 'Ah Huat',
      email: 'ahhuat@maxwell.sg',
      password: 'password123',
      menuItems: [
        {
          name: 'Steamed Chicken Rice',
          price: 5.50,
          description: 'Tender poached chicken served with fragrant rice'
        },
        {
          name: 'Roasted Chicken Rice',
          price: 5.50,
          description: 'Crispy skin roasted chicken with homemade chilli'
        }
      ]
    }, 'cognito-sub-12345');

    expect(result.success).toBe(true);
    expect(capturedPayload).toEqual({
      stall_name: 'Ah Huat Hainanese Chicken Rice',
      stall_number: '#01-56',
      stall_description: 'Famous traditional steamed & roasted chicken rice',
      stall_location: 'Maxwell Food Centre',
      stall_menu: [
        {
          name: 'Steamed Chicken Rice',
          price: 5.50,
          description: 'Tender poached chicken served with fragrant rice'
        },
        {
          name: 'Roasted Chicken Rice',
          price: 5.50,
          description: 'Crispy skin roasted chicken with homemade chilli'
        }
      ],
      stall_owner: {
        stall_owner_sub: 'cognito-sub-12345',
        name: 'Ah Huat',
        phone: '+65 9123 4567',
        email: 'ahhuat@maxwell.sg'
      }
    });
  });

  it('should pass entered username and mandatory email/password when initiating registration flow', async () => {
    vi.spyOn(authService, 'isCognitoConfigured').mockReturnValue(false);

    const req = {
      username: 'chickenrice_king',
      stallName: 'King Chicken Rice',
      hawkerCentreName: 'Amoy Street Food Centre',
      unitNumber: '#02-01',
      ownerName: 'Chef King',
      email: 'king@example.com',
      password: 'StrongPassword123!',
      menuItems: [{ name: 'King Chicken Rice', price: 6.00, description: 'Chef special' }]
    };

    const res = await authService.registerWithCognito(req);
    expect(res.success).toBe(true);
    expect(authService.pendingRegistration()?.username).toBe('chickenrice_king');
    expect(authService.pendingRegistration()?.email).toBe('king@example.com');
  });

  it('should login by username or email and reject login by stall name or unit #', async () => {
    vi.spyOn(authService, 'isCognitoConfigured').mockReturnValue(false);

    authService.registerStall({
      username: 'hokkien_uncle',
      stallName: 'Uncle Tan Fried Hokkien Prawn Mee',
      hawkerCentreName: 'Old Airport Road',
      unitNumber: '#01-88',
      uenNumber: '202412345K',
      contactNumber: '+65 9111 2222',
      ownerName: 'Uncle Tan',
      email: 'uncletan@oldairport.sg',
      password: 'password123',
      emoji: '🦐',
      cuisineCategory: 'Noodles',
      settings: {} as any
    });

    // Logging in by username succeeds
    const successLogin = await authService.login('hokkien_uncle', 'password123');
    expect(successLogin.success).toBe(true);
    expect(authService.currentSession()?.username).toBe('hokkien_uncle');

    // Email is accepted too: a backend-registered stall's only identifier is
    // the owner's email.
    const emailLogin = await authService.login('uncletan@oldairport.sg', 'password123');
    expect(emailLogin.success).toBe(true);
    expect(authService.currentSession()?.username).toBe('hokkien_uncle');

    // Logging in by stall name or unit # should fail
    const stallNameLogin = await authService.login('Uncle Tan Fried Hokkien Prawn Mee', 'password123');
    expect(stallNameLogin.success).toBe(false);

    const unitLogin = await authService.login('#01-88', 'password123');
    expect(unitLogin.success).toBe(false);
  });

  it('should fetch /v1/hawker/me/stall/{hawker_sub} upon login and populate store items', async () => {
    vi.spyOn(authService, 'isCognitoConfigured').mockReturnValue(false);

    const hawkerApiService = TestBed.inject(HawkerApiService);
    vi.spyOn(hawkerApiService, 'getHawkerStallBySub').mockResolvedValue({
      stall_id: 1,
      stall_name: 'Traditional Hainanese Chicken Rice',
      stall_menu: [
        {
          menu_id: 1,
          menu_name: 'Steamed Chicken Rice',
          menu_price: 5.0,
          menu_description: 'Fragrant rice with poached chicken & cucumber'
        },
        {
          menu_id: 2,
          menu_name: 'Roasted Chicken Rice',
          menu_price: 5.5,
          menu_description: 'Fragrant rice with roasted chicken & cucumber'
        }
      ]
    });

    const newStall = authService.registerStall({
      username: 'hainanese_master',
      stallName: 'Pending Stall',
      hawkerCentreName: 'Maxwell Food Centre',
      unitNumber: '#01-01',
      uenNumber: '202499999M',
      contactNumber: '+65 9000 1111',
      ownerName: 'Chef Hainan',
      email: 'hainan@maxwell.sg',
      password: 'password123',
      emoji: '🍗',
      cuisineCategory: 'Chicken Rice',
      cognitoSub: 'cognito-sub-hainanese-888',
      settings: {} as any
    });

    const loginRes = await authService.login('hainanese_master', 'password123');
    expect(loginRes.success).toBe(true);
    expect(authService.currentStall()?.stallName).toBe('Traditional Hainanese Chicken Rice');
    expect(authService.currentStall()?.initialMenuItems?.length).toBe(2);

    TestBed.flushEffects();
    const storeDishes = menuService.items();
    expect(storeDishes.some(d => d.name === 'Steamed Chicken Rice' && d.basePrice === 5.0)).toBe(true);
    expect(storeDishes.some(d => d.name === 'Roasted Chicken Rice' && d.basePrice === 5.5)).toBe(true);
  });
});
