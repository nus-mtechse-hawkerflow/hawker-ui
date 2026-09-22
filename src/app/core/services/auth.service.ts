import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { signUp, confirmSignUp, resendSignUpCode, signIn, signOut, getCurrentUser, fetchUserAttributes, fetchAuthSession } from 'aws-amplify/auth';
import { StallAccount, UserSession, HawkerRegisterRequest, SignUpFlowResult, BackendStallDto, BackendHawkerRegisterPayload } from '../models/auth.model';
import { MenuItem, Category } from '../models/menu.model';
import { environment } from '../../../environments/environment';
import { HawkerApiService } from './hawker-api.service';


const STALLS_STORAGE_KEY = 'hawkerflow_stalls_v1';
const SESSION_STORAGE_KEY = 'hawkerflow_session_v1';
const PENDING_REG_KEY = 'hawkerflow_pending_reg_v1';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);
  private hawkerApiService = inject(HawkerApiService);

  readonly allStalls = signal<StallAccount[]>(this.loadStalls());
  readonly currentSession = signal<UserSession | null>(this.loadSession());
  readonly pendingRegistration = signal<HawkerRegisterRequest | null>(this.loadPendingReg());
  readonly isBackendSyncing = signal<boolean>(false);

  readonly isAuthenticated = computed(() => this.currentSession() !== null);

  readonly currentStall = computed<StallAccount | null>(() => {
    const session = this.currentSession();
    const stalls = this.allStalls();
    if (session) {
      if (session.stallId) {
        const match = stalls.find(s => s.id === session.stallId);
        if (match) return match;
      }
      if (session.numericStallId) {
        const match = stalls.find(s => s.numericId === session.numericStallId);
        if (match) return match;
      }
      if (session.email) {
        const match = stalls.find(s => s.email.toLowerCase() === session.email.toLowerCase());
        if (match) return match;
      }
    }
    return stalls.length > 0 ? stalls[0] : null;
  });

  constructor() {
    // Initial fetch from backend 8080
    this.fetchBackendStalls().catch(err => {
      console.warn('Could not load initial stalls from backend:', err);
    });

    effect(() => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STALLS_STORAGE_KEY, JSON.stringify(this.allStalls()));
          if (this.currentSession()) {
            window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.currentSession()));
          } else {
            window.localStorage.removeItem(SESSION_STORAGE_KEY);
          }
          if (this.pendingRegistration()) {
            window.localStorage.setItem(PENDING_REG_KEY, JSON.stringify(this.pendingRegistration()));
          } else {
            window.localStorage.removeItem(PENDING_REG_KEY);
          }
        }
      } catch (e) {
        // storage fallback
      }
    });
  }

  /**
   * Load stalls from backend 8080
   */
  async fetchBackendStalls(): Promise<StallAccount[]> {
    this.isBackendSyncing.set(true);
    try {
      const res = await this.hawkerApiService.getStalls();
      if (res && res.stalls && Array.isArray(res.stalls)) {
        const backendStalls = res.stalls.map((s, index) => this.mapBackendStallToAccount(s, index));
        this.allStalls.set(backendStalls);
        return backendStalls;
      }
    } catch (err) {
      console.warn('Failed to fetch stalls from backend service (port 8080):', err);
    } finally {
      this.isBackendSyncing.set(false);
    }
    return this.allStalls();
  }


  private mapBackendStallToAccount(dto: BackendStallDto, index: number): StallAccount {
    const numericStallId = dto.stall_menu?.[0]?.f_stall_id ||
      dto.stall_owner?.[0]?.f_stall_id ||
      (dto as any).f_stall_id ||
      (dto as any).stall_id ||
      (index + 1);

    const stallId = `stall-${numericStallId}`;
    const owner = dto.stall_owner?.[0];
    const ownerName = owner?.f_stall_owner_name || 'Hawker Owner';
    const contactNumber = owner?.f_stall_owner_phone || '+65 9123 0000';
    const safeEmail = `${dto.stall_name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'stall'}_${numericStallId}@hawkerflow.sg`;

    const menuItems: MenuItem[] = (dto.stall_menu || []).map((m, mIdx) => ({
      id: `backend-dish-${m.f_menu_id || mIdx + 1}`,
      dishId: m.f_menu_id,
      stallId: m.f_stall_id || numericStallId,
      name: m.f_menu_name,
      description: m.f_menu_description || 'Specialty freshly prepared on order.',
      categoryId: 'mains',
      basePrice: Number(m.f_menu_price) || 5.0,
      emoji: '🍲',
      isAvailable: true,
      popularBadge: mIdx === 0 ? 'Signature' : undefined,
      preparationTimeMins: 4
    }));

    const categories: Category[] = [
      { id: 'all', name: 'All Items', chineseName: '全部', icon: 'utensils', displayOrder: 0 },
      { id: 'mains', name: 'Signatures', chineseName: '招牌', icon: 'flame', displayOrder: 1 },
      { id: 'drinks', name: 'Beverages', chineseName: '饮料', icon: 'coffee', displayOrder: 2 }
    ];

    return {
      id: stallId,
      numericId: numericStallId,
      stallName: dto.stall_name,
      hawkerCentreName: dto.stall_location || 'Local Hawker Centre',
      unitNumber: dto.stall_number || `#01-${String(numericStallId).padStart(2, '0')}`,
      uenNumber: '2024' + Math.floor(10000 + Math.random() * 90000) + 'X',
      contactNumber: contactNumber,
      ownerName: ownerName,
      email: safeEmail,
      password: 'password123',
      emoji: '🥘',
      cuisineCategory: dto.stall_description || 'Hawker Specialties',
      isEmailVerified: true,
      settings: {
        stallName: dto.stall_name,
        hawkerCentreName: dto.stall_location || 'Local Hawker Centre',
        unitNumber: dto.stall_number || `#01-${String(numericStallId).padStart(2, '0')}`,
        uenNumber: '2024' + Math.floor(10000 + Math.random() * 90000) + 'X',
        contactNumber: contactNumber,
        currencySymbol: 'SGD $',
        enableTakeawayFee: true,
        takeawayFeeAmount: 0.30,
        enableGst: false,
        gstRate: 0.09,
        isDarkTheme: false,
        soundAlertsEnabled: true,
        soundVolume: 0.8,
        kdsWarningThresholdMins: 5,
        kdsCriticalThresholdMins: 10
      },
      initialCategories: categories,
      initialMenuItems: menuItems.length > 0 ? menuItems : [
        {
          id: `dish-${numericStallId}-1`,
          dishId: 1,
          stallId: numericStallId,
          name: dto.stall_name + ' Signature',
          description: dto.stall_description || 'Chef recommendation freshly prepared.',
          categoryId: 'mains',
          basePrice: 5.50,
          emoji: '🍲',
          isAvailable: true,
          preparationTimeMins: 4
        }
      ],
      initialOrders: []
    };
  }


  private loadStalls(): StallAccount[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(STALLS_STORAGE_KEY);
        if (stored) {
          const parsed: StallAccount[] = JSON.parse(stored);
          if (parsed && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {
      // fallback
    }
    return [];
  }

  private loadSession(): UserSession | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch (e) {
      // fallback
    }
    return null;
  }


  private loadPendingReg(): HawkerRegisterRequest | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(PENDING_REG_KEY);
        if (stored) return JSON.parse(stored);
      }
    } catch (e) { }
    return null;
  }

  /**
   * Helper to determine if real Cognito credentials are configured
   */
  isCognitoConfigured(): boolean {
    return !!(
      environment.cognito?.userPoolId &&
      !environment.cognito.userPoolId.includes('xxxxxxxxx') &&
      environment.cognito?.userPoolClientId &&
      !environment.cognito.userPoolClientId.includes('xxxxxxxx')
    );
  }

  /**
   * 1. Register a new Hawker Stall Owner with AWS Cognito
   */
  async registerWithCognito(req: HawkerRegisterRequest): Promise<SignUpFlowResult> {
    const trimmedEmail = req.email.trim().toLowerCase();
    this.pendingRegistration.set(req);

    // If Cognito is configured with real credentials
    if (this.isCognitoConfigured()) {
      try {
        const userAttributes: Record<string, string> = {
          email: trimmedEmail,
          name: req.ownerName.trim()
        };

        if (req.contactNumber) {
          // Format phone number to E.164 if provided
          let phone = req.contactNumber.trim().replace(/\s+/g, '');
          if (!phone.startsWith('+')) {
            phone = '+65' + phone;
          }
          userAttributes['phone_number'] = phone;
        }

        const signUpResult = await signUp({
          username: trimmedEmail,
          password: req.password,
          options: {
            userAttributes,
            autoSignIn: true
          }
        });

        console.log("result is... ", signUpResult);

        if (signUpResult.isSignUpComplete) {
          // Sign up immediately complete (e.g. if pre-confirmed via Lambda trigger)
          this.provisionStallFromRequest(req, signUpResult.userId);
          this.pendingRegistration.set(null);
          return {
            success: true,
            isSignUpComplete: true,
            cognitoSub: signUpResult.userId
          };
        }

        return {
          success: true,
          isSignUpComplete: false,
          nextStep: signUpResult.nextStep?.signUpStep || 'CONFIRM_SIGN_UP_STEP'
        };
      } catch (err: any) {
        console.error('Cognito Sign-Up error:', err);
        return {
          success: false,
          isSignUpComplete: false,
          error: err.message || 'Cognito sign-up failed. Please check your details.'
        };
      }
    } else {
      // Demo / Offline mode: simulate OTP confirmation step or instant sign up
      return {
        success: true,
        isSignUpComplete: false,
        nextStep: 'CONFIRM_SIGN_UP_STEP'
      };
    }
  }

  /**
   * 2. Confirm registration code (OTP) sent to the hawker owner's email
   */
  async confirmCognitoSignUp(email: string, code: string): Promise<{ success: boolean; error?: string }> {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();
    const pending = this.pendingRegistration();

    if (this.isCognitoConfigured()) {
      try {
        const output = await confirmSignUp({
          username: trimmedEmail,
          confirmationCode: trimmedCode
        });

        if (output.isSignUpComplete) {
          if (pending && pending.email.toLowerCase() === trimmedEmail) {
            this.provisionStallFromRequest(pending);
            this.pendingRegistration.set(null);
          } else {
            // Find existing stall and activate session
            const match = this.allStalls().find(s => s.email.toLowerCase() === trimmedEmail);
            if (match) {
              this.quickLogin(match.id);
            }
          }
          return { success: true };
        }
        return { success: false, error: 'Confirmation incomplete. Please try again.' };
      } catch (err: any) {
        console.error('Cognito Confirmation error:', err);
        return { success: false, error: err.message || 'Invalid confirmation code. Please check and try again.' };
      }
    } else {
      // Offline / Demo Verification
      if (trimmedCode === '123456' || trimmedCode.length === 6) {
        if (pending && pending.email.toLowerCase() === trimmedEmail) {
          this.provisionStallFromRequest(pending);
          this.pendingRegistration.set(null);
        } else {
          // Provision with default
          this.provisionStallFromRequest({
            stallName: 'My Hawker Stall',
            hawkerCentreName: 'Local Hawker Centre',
            unitNumber: '#01-01',
            ownerName: 'Hawker Owner',
            email: trimmedEmail,
            password: 'password123'
          });
        }
        return { success: true };
      }
      return { success: false, error: 'Invalid verification code. (In demo mode, enter any 6-digit code like 123456).' };
    }
  }

  /**
   * 3. Resend the Cognito verification code
   */
  async resendCognitoCode(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const trimmedEmail = email.trim().toLowerCase();

    if (this.isCognitoConfigured()) {
      try {
        await resendSignUpCode({ username: trimmedEmail });
        return { success: true, message: `New confirmation code sent to ${trimmedEmail}` };
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to resend confirmation code.' };
      }
    } else {
      return { success: true, message: `Demo code resent! You can enter 123456 to verify.` };
    }
  }

  /**
   * Helper: Provisions a new StallAccount and establishes an active UserSession
   */
  private provisionStallFromRequest(req: HawkerRegisterRequest, cognitoSub?: string): StallAccount {
    const id = 'stall-' + Date.now();
    const newAccount: StallAccount = {
      id,
      stallName: req.stallName,
      hawkerCentreName: req.hawkerCentreName,
      unitNumber: req.unitNumber,
      uenNumber: req.uenNumber || '2024' + Math.floor(10000 + Math.random() * 90000) + 'X',
      contactNumber: req.contactNumber || '+65 9123 0000',
      ownerName: req.ownerName,
      email: req.email.toLowerCase(),
      password: req.password,
      emoji: req.emoji || '🥘',
      cuisineCategory: req.cuisineCategory || 'Hawker Specialties',
      cognitoSub,
      isEmailVerified: true,
      settings: {
        stallName: req.stallName,
        hawkerCentreName: req.hawkerCentreName,
        unitNumber: req.unitNumber,
        uenNumber: req.uenNumber || '2024' + Math.floor(10000 + Math.random() * 90000) + 'X',
        contactNumber: req.contactNumber || '+65 9123 0000',
        currencySymbol: 'SGD $',
        enableTakeawayFee: true,
        takeawayFeeAmount: 0.30,
        enableGst: false,
        gstRate: 0.09,
        isDarkTheme: false,
        soundAlertsEnabled: true,
        soundVolume: 0.8,
        kdsWarningThresholdMins: 5,
        kdsCriticalThresholdMins: 10
      },
      initialCategories: [
        { id: 'all', name: 'All Items', chineseName: '全部', icon: 'utensils', displayOrder: 0 },
        { id: 'mains', name: 'Signatures', chineseName: '招牌', icon: 'flame', displayOrder: 1 },
        { id: 'drinks', name: 'Beverages', chineseName: '饮料', icon: 'coffee', displayOrder: 2 }
      ],
      initialMenuItems: [
        {
          id: 'dish-' + Date.now(),
          name: req.stallName + ' Signature Special',
          chineseName: '招牌推荐',
          description: 'Chef recommendation freshly prepared on order.',
          categoryId: 'mains',
          basePrice: 6.50,
          emoji: req.emoji || '🍲',
          isAvailable: true,
          popularBadge: 'Signature',
          preparationTimeMins: 4
        }
      ],
      initialOrders: []
    };

    this.allStalls.update(list => [newAccount, ...list]);
    this.quickLogin(newAccount.id);
    return newAccount;
  }

  /**
   * Standard login method supporting both Cognito and registered stalls
   */
  async login(identifier: string, password?: string): Promise<{ success: boolean; error?: string }> {
    const term = identifier.trim().toLowerCase();

    // 1. If Cognito is active, attempt Cognito signIn first
    if (this.isCognitoConfigured() && password) {
      try {
        const cognitoUser = await signIn({
          username: term,
          password: password
        });

        if (cognitoUser.isSignedIn) {
          const currentUser = await fetchUserAttributes();
          const userSession = await fetchAuthSession();
          console.log("user attributes", currentUser);
          localStorage.setItem("accessToken", userSession.tokens!.accessToken.toString());

          const stalls = this.allStalls();
          const match = stalls.find(s => s.email.toLowerCase() === term);

          const session: UserSession = {
            stallId: match ? match.id : 'stall-cognito-' + Date.now(),
            email: term,
            ownerName: match ? match.ownerName : 'Hawker Owner',
            role: 'owner',
            loggedInAt: new Date().toISOString()
          };

          this.currentSession.set(session);
          this.router.navigate(['/pos']);
          return { success: true };
        }
      } catch (err: any) {
        console.warn('Cognito login attempt failed, falling back to local credentials:', err.message);
      }
    }

    // 2. Local matching fallback (prioritize exact match over fuzzy match)
    const stalls = this.allStalls();
    const match = stalls.find(s => s.unitNumber.toLowerCase() === term)
      || stalls.find(s => s.id.toLowerCase() === term)
      || stalls.find(s => String(s.numericId) === term)
      || stalls.find(s => s.email.toLowerCase() === term)
      || stalls.find(s => s.stallName.toLowerCase() === term)
      || stalls.find(s => s.stallName.toLowerCase().includes(term))
      || stalls.find(s => s.ownerName.toLowerCase().includes(term));

    if (!match) {
      return { success: false, error: 'No stall account found matching these credentials.' };
    }

    if (password && match.password && match.password !== password) {
      return { success: false, error: 'Incorrect password for this stall account.' };
    }


    const session: UserSession = {
      stallId: match.id,
      numericStallId: match.numericId,
      email: match.email,
      ownerName: match.ownerName,
      role: 'owner',
      loggedInAt: new Date().toISOString()
    };

    this.currentSession.set(session);
    this.router.navigate(['/pos']);
    return { success: true };
  }

  quickLogin(stallId: string): void {
    const match = this.allStalls().find(s => s.id === stallId || String(s.numericId) === stallId);
    if (!match) return;

    const session: UserSession = {
      stallId: match.id,
      numericStallId: match.numericId,
      email: match.email,
      ownerName: match.ownerName,
      role: 'owner',
      loggedInAt: new Date().toISOString()
    };

    this.currentSession.set(session);
    this.router.navigate(['/pos']);
  }

  /**
   * Register a new hawker with backend 8080 (/v1/hawker/register)
   * Also provisions local session and updates stall list.
   */
  async registerHawkerStall(req: HawkerRegisterRequest): Promise<{ success: boolean; stall?: StallAccount; error?: string }> {
    const dishes = (req.menuItems && req.menuItems.length > 0)
      ? req.menuItems.map(d => ({
          name: d.name.trim(),
          price: Number(d.price) || 5.0,
          description: d.description?.trim() || 'Signature specialty freshly prepared.'
        }))
      : [
          {
            name: `${req.stallName} Signature Dish`,
            price: 5.50,
            description: req.stallDescription || 'Chef recommendation freshly cooked.'
          }
        ];

    const payload: BackendHawkerRegisterPayload = {
      stall_name: req.stallName.trim(),
      stall_number: req.unitNumber.trim(),
      stall_description: req.stallDescription?.trim() || req.cuisineCategory?.trim() || 'Hawker Specialties',
      stall_location: req.hawkerCentreName.trim(),
      stall_menu: dishes,
      stall_owner: {
        name: req.ownerName.trim(),
        phone: req.contactNumber?.trim() || '91234567'
      }
    };

    try {
      // 1. Submit to Backend Service (port 8080)
      const backendRes = await this.hawkerApiService.registerHawker(payload);
      console.log('Backend 8080 Hawker registration response:', backendRes);

      // 2. Refresh stalls from backend
      const updatedStalls = await this.fetchBackendStalls();

      // 3. Find newly created stall (match by name)
      const matched = updatedStalls.find(
        s => s.stallName.toLowerCase() === req.stallName.trim().toLowerCase()
      );

      if (matched) {
        this.quickLogin(matched.id);
        return { success: true, stall: matched };
      }

      // Fallback: provision locally if backend didn't list it yet
      const fallbackAccount = this.provisionStallFromRequest(req);
      return { success: true, stall: fallbackAccount };
    } catch (err: any) {
      console.warn('Backend registration failed, attempting local fallback:', err);
      // If backend network error, still allow local provisioning
      const fallbackAccount = this.provisionStallFromRequest(req);
      return {
        success: true,
        stall: fallbackAccount,
        error: `Created in local session (Backend notice: ${err.message || 'connection issue'})`
      };
    }
  }

  registerStall(newStall: Omit<StallAccount, 'id'>): StallAccount {
    return this.provisionStallFromRequest({
      stallName: newStall.stallName,
      hawkerCentreName: newStall.hawkerCentreName,
      unitNumber: newStall.unitNumber,
      uenNumber: newStall.uenNumber,
      contactNumber: newStall.contactNumber,
      ownerName: newStall.ownerName,
      email: newStall.email,
      password: newStall.password || 'password123',
      emoji: newStall.emoji,
      cuisineCategory: newStall.cuisineCategory
    });
  }

  updateCurrentStall(updates: Partial<StallAccount>): void {
    const current = this.currentStall();
    if (!current) return;

    this.allStalls.update(list =>
      list.map(s => (s.id === current.id ? { ...s, ...updates } : s))
    );
  }

  async logout(): Promise<void> {
    if (this.isCognitoConfigured()) {
      try {
        await signOut();
      } catch (e) {
        console.warn('Cognito signOut error:', e);
      }
    }
    this.currentSession.set(null);
    this.router.navigate(['/login']);
  }
}

