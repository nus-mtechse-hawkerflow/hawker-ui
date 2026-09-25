import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { signUp, confirmSignUp, resendSignUpCode, signIn, signOut, getCurrentUser, fetchUserAttributes, fetchAuthSession } from 'aws-amplify/auth';
import { StallAccount, UserSession, HawkerRegisterRequest, SignUpFlowResult, BackendStallDto, BackendHawkerRegisterPayload, HawkerMeStallDto, HawkerMeMenuItemDto } from '../models/auth.model';
import { MenuItem, Category } from '../models/menu.model';
import { environment } from '../../../environments/environment';
import { HawkerApiService } from './hawker-api.service';


const SESSION_STORAGE_KEY = 'hawkerflow_session_v1';
const PENDING_REG_KEY = 'hawkerflow_pending_reg_v1';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);
  private hawkerApiService = inject(HawkerApiService);

  readonly allStalls = signal<StallAccount[]>([]);
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
    return null;
  });

  constructor() {
    // Initial fetch from backend 8080
    this.fetchBackendStalls().catch(err => {
      console.warn('Could not load initial stalls from backend:', err);
    });

    effect(() => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
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
    const ownerName = owner?.f_stall_owner_name || '';
    const contactNumber = owner?.f_stall_owner_phone || '';
    const safeEmail = `${dto.stall_name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'stall'}_${numericStallId}@hawkerflow.sg`;

    const menuItems: MenuItem[] = (dto.stall_menu || []).map((m, mIdx) => ({
      id: `backend-dish-${m.f_menu_id || mIdx + 1}`,
      dishId: m.f_menu_id,
      stallId: m.f_stall_id || numericStallId,
      name: m.f_menu_name,
      description: m.f_menu_description || '',
      categoryId: 'mains',
      basePrice: Number(m.f_menu_price) || 0,
      emoji: '🍲',
      isAvailable: true,
      popularBadge: mIdx === 0 ? 'Signature' : undefined,
      preparationTimeMins: 4
    }));

    const categories: Category[] = [
      { id: 'all', name: 'All Items', chineseName: '全部', icon: 'utensils', displayOrder: 0 },
      { id: 'mains', name: 'Signatures', chineseName: '招牌', icon: 'flame', displayOrder: 1 }
    ];

    return {
      id: stallId,
      numericId: numericStallId,
      stallName: dto.stall_name,
      hawkerCentreName: dto.stall_location || '',
      unitNumber: dto.stall_number || '',
      uenNumber: '',
      contactNumber: contactNumber,
      ownerName: ownerName,
      email: safeEmail,
      password: '',
      emoji: '🥘',
      cuisineCategory: dto.stall_description || '',
      isEmailVerified: true,
      settings: {
        stallName: dto.stall_name,
        hawkerCentreName: dto.stall_location || '',
        unitNumber: dto.stall_number || '',
        uenNumber: '',
        contactNumber: contactNumber,
        currencySymbol: 'SGD $',
        enableTakeawayFee: false,
        takeawayFeeAmount: 0,
        enableGst: false,
        gstRate: 0.09,
        isDarkTheme: false,
        soundAlertsEnabled: true,
        soundVolume: 0.8,
        kdsWarningThresholdMins: 5,
        kdsCriticalThresholdMins: 10
      },
      initialCategories: categories,
      initialMenuItems: menuItems,
      initialOrders: []
    };
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
    const trimmedUsername = req.username.trim();

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
          username: trimmedUsername,
          password: req.password,
          options: {
            userAttributes,
            autoSignIn: true
          }
        });

        console.log('Cognito signUp result:', signUpResult);

        const sub = signUpResult.userId;
        const updatedReq: HawkerRegisterRequest = {
          ...req,
          cognitoSub: sub
        };
        this.pendingRegistration.set(updatedReq);

        if (signUpResult.isSignUpComplete) {
          // Sign up immediately complete (e.g. if pre-confirmed via Lambda trigger)
          await this.registerHawkerStall(updatedReq, sub);
          this.pendingRegistration.set(null);
          return {
            success: true,
            isSignUpComplete: true,
            cognitoSub: sub
          };
        }

        return {
          success: true,
          isSignUpComplete: false,
          cognitoSub: sub,
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
      const mockSub = `sub-local-${Date.now()}`;
      const updatedReq: HawkerRegisterRequest = {
        ...req,
        cognitoSub: mockSub
      };
      this.pendingRegistration.set(updatedReq);
      return {
        success: true,
        isSignUpComplete: false,
        cognitoSub: mockSub,
        nextStep: 'CONFIRM_SIGN_UP_STEP'
      };
    }
  }

  /**
   * 2. Confirm registration code (OTP) sent to the hawker owner's email
   */
  async confirmCognitoSignUp(usernameOrEmail: string, code: string): Promise<{ success: boolean; error?: string }> {
    const trimmedUser = usernameOrEmail.trim();
    const trimmedCode = code.trim();
    const pending = this.pendingRegistration();
    const cognitoUsername = pending?.username || trimmedUser;

    if (this.isCognitoConfigured()) {
      try {
        const output = await confirmSignUp({
          username: cognitoUsername,
          confirmationCode: trimmedCode
        });

        if (output.isSignUpComplete) {
          if (pending && (pending.username.toLowerCase() === cognitoUsername.toLowerCase() || pending.email.toLowerCase() === trimmedUser.toLowerCase())) {
            await this.registerHawkerStall(pending, pending.cognitoSub);
            this.pendingRegistration.set(null);
          } else {
            // Find existing stall and activate session
            const match = this.allStalls().find(s => s.username?.toLowerCase() === cognitoUsername.toLowerCase() || s.email.toLowerCase() === trimmedUser.toLowerCase());
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
        if (pending && (pending.username.toLowerCase() === cognitoUsername.toLowerCase() || pending.email.toLowerCase() === trimmedUser.toLowerCase())) {
          await this.registerHawkerStall(pending, pending.cognitoSub || `sub-demo-${Date.now()}`);
          this.pendingRegistration.set(null);
          return { success: true };
        } else {
          return { success: false, error: 'No pending registration found. Please register first.' };
        }
      }
      return { success: false, error: 'Invalid verification code. (In demo mode, enter any 6-digit code like 123456).' };
    }
  }

  /**
   * 3. Resend the Cognito verification code
   */
  async resendCognitoCode(usernameOrEmail: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const pending = this.pendingRegistration();
    const cognitoUsername = pending?.username || usernameOrEmail.trim();

    if (this.isCognitoConfigured()) {
      try {
        await resendSignUpCode({ username: cognitoUsername });
        return { success: true, message: `New confirmation code sent for ${cognitoUsername}` };
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
    const centre = req.hawkerCentreName || '';
    const menuItems: MenuItem[] = (req.menuItems || []).map((m, idx) => ({
      id: `dish-${Date.now()}-${idx + 1}`,
      name: m.name,
      description: m.description || '',
      categoryId: 'mains',
      basePrice: Number(m.price) || 0,
      emoji: '🍲',
      isAvailable: true,
      popularBadge: idx === 0 ? 'Signature' : undefined,
      preparationTimeMins: 4
    }));

    const newAccount: StallAccount = {
      id,
      username: req.username,
      stallName: req.stallName,
      hawkerCentreName: centre,
      unitNumber: req.unitNumber,
      uenNumber: req.uenNumber || '',
      contactNumber: req.contactNumber || '',
      ownerName: req.ownerName,
      email: req.email.toLowerCase(),
      password: req.password,
      emoji: req.emoji || '🥘',
      cuisineCategory: req.cuisineCategory || req.stallDescription || '',
      cognitoSub,
      isEmailVerified: true,
      settings: {
        stallName: req.stallName,
        hawkerCentreName: centre,
        unitNumber: req.unitNumber,
        uenNumber: req.uenNumber || '',
        contactNumber: req.contactNumber || '',
        currencySymbol: 'SGD $',
        enableTakeawayFee: false,
        takeawayFeeAmount: 0,
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
        { id: 'mains', name: 'Signatures', chineseName: '招牌', icon: 'flame', displayOrder: 1 }
      ],
      initialMenuItems: menuItems,
      initialOrders: []
    };

    this.allStalls.update(list => [newAccount, ...list]);
    this.quickLogin(newAccount.id);
    return newAccount;
  }

  /**
   * Login method strictly authenticating hawkers by username
   * Upon successful login, fetches stall and store items via GET /v1/hawker/me/stall/{hawker_sub}
   */
  async login(username: string, password?: string): Promise<{ success: boolean; error?: string }> {
    const term = username.trim().toLowerCase();

    // 1. If Cognito is active, attempt Cognito signIn with username
    if (this.isCognitoConfigured() && password) {
      try {
        const cognitoUser = await signIn({
          username: term,
          password: password
        });

        if (cognitoUser.isSignedIn) {
          const currentUser = await fetchUserAttributes();
          const userSession = await fetchAuthSession();
          console.log('Cognito user attributes:', currentUser);
          if (userSession.tokens?.accessToken) {
            localStorage.setItem('accessToken', userSession.tokens.accessToken.toString());
          }

          const hawkerSub = currentUser.sub || (userSession.tokens?.idToken?.payload?.sub as string) || (currentUser as any)['sub'] || '';

          // Fetch stall details & menu items from backend API
          let backendStall: HawkerMeStallDto | null = null;
          if (hawkerSub) {
            try {
              backendStall = await this.hawkerApiService.getHawkerStallBySub(hawkerSub);
              console.log('Fetched hawker stall from backend port 8080:', backendStall);
            } catch (err) {
              console.warn(`Failed to fetch stall for hawker sub (${hawkerSub}):`, err);
            }
          }

          if (backendStall) {
            const stallId = `stall-${backendStall.stall_id}`;
            const menuItems: MenuItem[] = (backendStall.stall_menu || []).map((m, idx) => ({
              id: `backend-dish-${m.menu_id || idx + 1}`,
              dishId: m.menu_id,
              stallId: backendStall!.stall_id,
              name: m.menu_name,
              description: m.menu_description || 'Specialty freshly prepared on order.',
              categoryId: 'mains',
              basePrice: Number(m.menu_price) || 5.0,
              emoji: '🍲',
              isAvailable: true,
              popularBadge: idx === 0 ? 'Signature' : undefined,
              preparationTimeMins: 4
            }));

            const existingStalls = this.allStalls();
            const existing = existingStalls.find(s => s.id === stallId || s.username?.toLowerCase() === term);

            const stallAccount: StallAccount = {
              id: stallId,
              numericId: backendStall.stall_id,
              username: term,
              stallName: backendStall.stall_name,
              hawkerCentreName: backendStall.stall_location || existing?.hawkerCentreName || '',
              unitNumber: backendStall.stall_number || existing?.unitNumber || `#01-${String(backendStall.stall_id).padStart(2, '0')}`,
              uenNumber: existing?.uenNumber || ('2024' + Math.floor(10000 + Math.random() * 90000) + 'X'),
              contactNumber: currentUser.phone_number || existing?.contactNumber || '',
              ownerName: currentUser.name || existing?.ownerName || term,
              email: currentUser.email || existing?.email || `${term}@hawkerflow.sg`,
              password: password,
              emoji: existing?.emoji || '🥘',
              cuisineCategory: backendStall.stall_description || existing?.cuisineCategory || '',
              cognitoSub: hawkerSub,
              isEmailVerified: true,
              settings: existing?.settings || {
                stallName: backendStall.stall_name,
                hawkerCentreName: backendStall.stall_location || '',
                unitNumber: backendStall.stall_number || '',
                uenNumber: '',
                contactNumber: currentUser.phone_number || '',
                currencySymbol: 'SGD $',
                enableTakeawayFee: false,
                takeawayFeeAmount: 0,
                enableGst: false,
                gstRate: 0.09,
                isDarkTheme: false,
                soundAlertsEnabled: true,
                soundVolume: 0.8,
                kdsWarningThresholdMins: 5,
                kdsCriticalThresholdMins: 10
              },
              initialCategories: existing?.initialCategories || [
                { id: 'all', name: 'All Items', chineseName: '全部', icon: 'utensils', displayOrder: 0 },
                { id: 'mains', name: 'Signatures', chineseName: '招牌', icon: 'flame', displayOrder: 1 }
              ],
              initialMenuItems: menuItems,
              initialOrders: existing?.initialOrders || []
            };

            this.allStalls.update(stalls => {
              const remaining = stalls.filter(s => s.id !== stallId && s.username?.toLowerCase() !== term);
              return [stallAccount, ...remaining];
            });

            const session: UserSession = {
              stallId: stallId,
              numericStallId: backendStall.stall_id,
              username: term,
              email: currentUser.email || `${term}@hawkerflow.sg`,
              ownerName: currentUser.name || term,
              role: 'owner',
              loggedInAt: new Date().toISOString(),
              cognitoSub: hawkerSub
            };

            this.currentSession.set(session);
            this.router.navigate(['/pos']);
            return { success: true };
          }

          // Fallback if backend /me/stall endpoint was unreachable
          const stalls = this.allStalls();
          const match = stalls.find(s => s.username?.toLowerCase() === term);

          const session: UserSession = {
            stallId: match ? match.id : 'stall-cognito-' + Date.now(),
            username: match?.username || term,
            email: match?.email || currentUser.email || `${term}@hawkerflow.sg`,
            ownerName: match ? match.ownerName : (currentUser.name || 'Hawker Owner'),
            role: 'owner',
            loggedInAt: new Date().toISOString(),
            cognitoSub: hawkerSub
          };

          this.currentSession.set(session);
          this.router.navigate(['/pos']);
          return { success: true };
        }
      } catch (err: any) {
        console.warn('Cognito login attempt failed, falling back to local credentials:', err.message);
      }
    }

    // 2. Local matching fallback (strictly matching by username)
    const stalls = this.allStalls();
    const match = stalls.find(s => s.username?.toLowerCase() === term);

    if (!match) {
      return { success: false, error: 'No hawker stall account found matching this username.' };
    }

    if (password && match.password && match.password !== password) {
      return { success: false, error: 'Incorrect password for this hawker account.' };
    }

    // If matching stall has a cognitoSub, try fetching from backend to populate store items
    let targetStallId = match.id;
    let targetNumericId = match.numericId;
    if (match.cognitoSub) {
      try {
        const backendStall = await this.hawkerApiService.getHawkerStallBySub(match.cognitoSub);
        if (backendStall) {
          const stallId = `stall-${backendStall.stall_id}`;
          targetStallId = stallId;
          targetNumericId = backendStall.stall_id;
          const menuItems: MenuItem[] = (backendStall.stall_menu || []).map((m, idx) => ({
            id: `backend-dish-${m.menu_id || idx + 1}`,
            dishId: m.menu_id,
            stallId: backendStall.stall_id,
            name: m.menu_name,
            description: m.menu_description || 'Specialty freshly prepared on order.',
            categoryId: 'mains',
            basePrice: Number(m.menu_price) || 5.0,
            emoji: '🍲',
            isAvailable: true,
            popularBadge: idx === 0 ? 'Signature' : undefined,
            preparationTimeMins: 4
          }));

          const updatedMatch: StallAccount = {
            ...match,
            id: stallId,
            numericId: backendStall.stall_id,
            stallName: backendStall.stall_name,
            initialMenuItems: menuItems,
            settings: {
              ...match.settings,
              stallName: backendStall.stall_name
            }
          };
          this.allStalls.update(stalls => stalls.map(s => s.id === match.id ? updatedMatch : s));
        }
      } catch (err) {
        console.warn('Backend sync on local login skipped:', err);
      }
    }

    const session: UserSession = {
      stallId: targetStallId,
      numericStallId: targetNumericId,
      username: match.username,
      email: match.email,
      ownerName: match.ownerName,
      role: 'owner',
      loggedInAt: new Date().toISOString(),
      cognitoSub: match.cognitoSub
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
      username: match.username,
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
  async registerHawkerStall(req: HawkerRegisterRequest, cognitoSub?: string): Promise<{ success: boolean; stall?: StallAccount; error?: string }> {
    const dishes = (req.menuItems && req.menuItems.length > 0)
      ? req.menuItems.map(d => ({
          name: d.name.trim(),
          price: Number(d.price) || 0,
          description: d.description?.trim() || ''
        }))
      : [];

    const sub = cognitoSub || req.cognitoSub || `sub-${Date.now()}`;
    const payload: BackendHawkerRegisterPayload = {
      stall_name: req.stallName.trim(),
      stall_number: req.unitNumber.trim(),
      stall_description: req.stallDescription?.trim() || req.cuisineCategory?.trim() || '',
      stall_location: req.hawkerCentreName?.trim() || '',
      stall_menu: dishes,
      stall_owner: {
        stall_owner_sub: sub,
        name: req.ownerName.trim(),
        phone: req.contactNumber?.trim() || '',
        email: req.email.trim().toLowerCase()
      }
    };

    try {
      // 1. Submit to Backend Service (port 8080)
      const backendRes = await this.hawkerApiService.registerHawker(payload);
      console.log('Backend 8080 Hawker registration response:', backendRes);

      // 2. Refresh stalls from backend
      const updatedStalls = await this.fetchBackendStalls();

      // 3. Find newly created stall (match by name or email)
      const matched = updatedStalls.find(
        s => s.stallName.toLowerCase() === req.stallName.trim().toLowerCase() ||
             s.email.toLowerCase() === req.email.trim().toLowerCase()
      );

      if (matched) {
        this.quickLogin(matched.id);
        return { success: true, stall: matched };
      }

      // Fallback: provision locally if backend didn't list it yet
      const fallbackAccount = this.provisionStallFromRequest(req, sub);
      return { success: true, stall: fallbackAccount };
    } catch (err: any) {
      console.warn('Backend registration failed, attempting local fallback:', err);
      // If backend network error, still allow local provisioning
      const fallbackAccount = this.provisionStallFromRequest(req, sub);
      return {
        success: true,
        stall: fallbackAccount,
        error: `Created in local session (Backend notice: ${err.message || 'connection issue'})`
      };
    }
  }

  registerStall(newStall: Omit<StallAccount, 'id'>): StallAccount {
    return this.provisionStallFromRequest({
      username: newStall.username || newStall.email.split('@')[0] || 'stalluser',
      stallName: newStall.stallName,
      hawkerCentreName: newStall.hawkerCentreName,
      unitNumber: newStall.unitNumber,
      uenNumber: newStall.uenNumber,
      contactNumber: newStall.contactNumber,
      ownerName: newStall.ownerName,
      email: newStall.email,
      password: newStall.password || 'password123',
      emoji: newStall.emoji,
      cuisineCategory: newStall.cuisineCategory,
      cognitoSub: newStall.cognitoSub
    }, newStall.cognitoSub);
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

