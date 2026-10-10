import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  readonly authService = inject(AuthService);
  private router = inject(Router);

  activeTab = signal<'login' | 'register'>('login');
  registerStep = signal<'form' | 'confirm_code'>('form');

  isLoading = signal<boolean>(false);
  errorMessage = signal<string>('');
  successMessage = signal<string>('');

  // Login Form
  loginUsername = '';
  loginPassword = '';

  // Register Form
  regUsername = '';
  regEmail = '';
  regPassword = '';
  regStallName = '';
  regUnitNumber = '';
  regStallDescription = '';
  regOwnerName = '';
  regContactNumber = '';
  regEmoji = '🥘';
  regCuisine = '';

  // Dynamic dishes builder for registration
  regDishes = signal<Array<{ name: string; price: number; description: string }>>([
    { name: '', price: 5.00, description: '' }
  ]);


  // Verification Form
  confirmCode = '';
  pendingVerificationUsername = signal<string>('');
  pendingVerificationEmail = signal<string>('');

  addDish(): void {
    this.regDishes.update(dishes => [
      ...dishes,
      { name: '', price: 5.00, description: '' }
    ]);
  }

  removeDish(index: number): void {
    this.regDishes.update(dishes => {
      if (dishes.length <= 1) return dishes;
      return dishes.filter((_, i) => i !== index);
    });
  }

  async onFormLogin(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (!this.loginUsername.trim()) {
      this.errorMessage.set('Please enter your username.');
      return;
    }

    this.isLoading.set(true);

    try {
      const res = await this.authService.login(this.loginUsername.trim(), this.loginPassword);
      if (!res.success) {
        this.errorMessage.set(res.error || 'Login failed');
      }
    } catch (err: any) {
      this.errorMessage.set(err.message || 'An unexpected error occurred.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onRegisterStall(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');

    const username = this.regUsername.trim();
    const email = this.regEmail.trim().toLowerCase();
    const password = this.regPassword.trim();
    const stallName = this.regStallName.trim();
    const unitNumber = this.regUnitNumber.trim();
    const ownerName = this.regOwnerName.trim();

    if (!username) {
      this.errorMessage.set('Username is required for hawker registration.');
      return;
    }

    if (!email) {
      this.errorMessage.set('Email is mandatory for hawker registration.');
      return;
    }

    if (!password) {
      this.errorMessage.set('Password is mandatory for hawker registration.');
      return;
    }

    if (!stallName || !unitNumber || !ownerName) {
      this.errorMessage.set('Please fill in all required stall and owner details (Stall Name, Unit #, Owner Name).');
      return;
    }

    const validDishes = this.regDishes().filter(d => d.name.trim().length > 0);
    if (validDishes.length === 0) {
      this.errorMessage.set('Please add at least one dish for your stall menu.');
      return;
    }

    this.isLoading.set(true);

    try {
      const req = {
        username: username,
        email: email,
        password: password,
        stallName: stallName,
        unitNumber: unitNumber,
        stallDescription: this.regStallDescription.trim() || this.regCuisine.trim() || 'Hawker Specialties',
        contactNumber: this.regContactNumber.trim() || '+65 9123 0000',
        ownerName: ownerName,
        emoji: this.regEmoji.trim() || '🥘',
        cuisineCategory: this.regCuisine.trim() || 'Hawker Specialties',
        menuItems: validDishes
      };

      if (this.authService.isCognitoConfigured()) {
        const signUpRes = await this.authService.registerWithCognito(req);
        if (!signUpRes.success) {
          this.errorMessage.set(signUpRes.error || 'Cognito registration failed.');
          return;
        }

        if (signUpRes.isSignUpComplete) {
          this.successMessage.set(`Stall "${stallName}" registered successfully! Redirecting to POS...`);
          setTimeout(() => {
            this.router.navigate(['/pos']);
          }, 700);
        } else {
          this.pendingVerificationUsername.set(username);
          this.pendingVerificationEmail.set(email);
          this.registerStep.set('confirm_code');
          this.successMessage.set(`Verification code sent to ${email} for user "${username}". Please check your inbox.`);
        }
      } else {
        const result = await this.authService.registerHawkerStall(req);
        if (!result.success) {
          this.errorMessage.set(result.error || 'Registration failed.');
          return;
        }

        this.successMessage.set(`Stall "${stallName}" registered successfully! Redirecting to POS...`);
        setTimeout(() => {
          this.router.navigate(['/pos']);
        }, 700);
      }
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Failed to submit registration.');
    } finally {
      this.isLoading.set(false);
    }
  }


  async onConfirmCode(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (!this.confirmCode || this.confirmCode.trim().length < 6) {
      this.errorMessage.set('Please enter a valid 6-digit confirmation code.');
      return;
    }

    this.isLoading.set(true);

    try {
      const identifier = this.pendingVerificationUsername() || this.regUsername.trim() || this.pendingVerificationEmail() || this.regEmail.trim().toLowerCase();
      const result = await this.authService.confirmCognitoSignUp(identifier, this.confirmCode.trim());

      if (result.success) {
        this.successMessage.set('Verification successful! Stall registered and POS ready. Redirecting...');
        setTimeout(() => {
          this.router.navigate(['/pos']);
        }, 700);
      } else {
        this.errorMessage.set(result.error || 'Verification failed. Please check the code.');
      }
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Error verifying code.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onResendCode(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    const identifier = this.pendingVerificationUsername() || this.regUsername.trim() || this.pendingVerificationEmail() || this.regEmail.trim().toLowerCase();
    
    if (!identifier) return;

    this.isLoading.set(true);
    try {
      const res = await this.authService.resendCognitoCode(identifier);
      if (res.success) {
        this.successMessage.set(res.message || `New code sent for ${identifier}`);
      } else {
        this.errorMessage.set(res.error || 'Failed to resend code.');
      }
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Failed to resend verification code.');
    } finally {
      this.isLoading.set(false);
    }
  }

  onBackToRegisterForm(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.registerStep.set('form');
  }
}
