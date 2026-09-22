import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';
import { MenuService } from './core/services/menu.service';
import { SettingsService } from './core/services/settings.service';


describe('HawkerFlow App & Multi-Stall System', () => {
  let authService: AuthService;
  let menuService: MenuService;
  let settingsService: SettingsService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)]
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
    expect(authService.currentStall().id).toBe(newStall.id);
    expect(authService.currentStall().stallName).toBe('Marina Bay Satay Club');

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
});
