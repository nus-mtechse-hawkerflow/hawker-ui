import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { vi } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';
import { MenuService } from './core/services/menu.service';
import { SettingsService } from './core/services/settings.service';
import { HawkerApiService } from './core/services/hawker-api.service';


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

  it('should login strictly by username and reject login by email, stall name, or unit #', async () => {
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

    // Logging in by email or stall name or unit # should fail
    const emailLogin = await authService.login('uncletan@oldairport.sg', 'password123');
    expect(emailLogin.success).toBe(false);

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
