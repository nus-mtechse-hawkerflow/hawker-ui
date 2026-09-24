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
  loginIdentifier = '';
  loginPassword = '';

  // Register Form
  regStallName = '';
  regHawkerCentre = '';
  regUnitNumber = '';
  regStallDescription = '';
  regOwnerName = '';
  regContactNumber = '';
  regEmail = '';
  regPassword = '';
  regEmoji = '🥘';
  regCuisine = '';

  // Dynamic dishes builder for registration
  regDishes = signal<Array<{ name: string; price: number; description: string }>>([
    { name: '', price: 5.00, description: '' }
  ]);


  // Verification Form
  confirmCode = '';
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
    this.isLoading.set(true);

    try {
      const res = await this.authService.login(this.loginIdentifier, this.loginPassword);
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

    if (!this.regStallName.trim() || !this.regHawkerCentre.trim() || !this.regUnitNumber.trim() || !this.regOwnerName.trim()) {
      this.errorMessage.set('Please fill in all required stall and owner details.');
      return;
    }

    const validDishes = this.regDishes().filter(d => d.name.trim().length > 0);
    if (validDishes.length === 0) {
      this.errorMessage.set('Please add at least one dish for your stall menu.');
      return;
    }

    this.isLoading.set(true);

    try {
      const email = (this.regEmail.trim() || `${this.regStallName.toLowerCase().replace(/[^a-z0-9]/g, '')}@hawkerflow.sg`).toLowerCase();
      
      const result = await this.authService.registerHawkerStall({
        stallName: this.regStallName.trim(),
        hawkerCentreName: this.regHawkerCentre.trim(),
        unitNumber: this.regUnitNumber.trim(),
        stallDescription: this.regStallDescription.trim() || this.regCuisine.trim(),
        contactNumber: this.regContactNumber.trim() || '+65 9123 0000',
        ownerName: this.regOwnerName.trim(),
        email: email,
        password: this.regPassword || 'password123',
        emoji: this.regEmoji.trim() || '🥘',
        cuisineCategory: this.regCuisine.trim() || 'Hawker Specialties',
        menuItems: validDishes
      });

      if (!result.success) {
        this.errorMessage.set(result.error || 'Registration failed.');
        return;
      }

      this.successMessage.set(`Stall "${this.regStallName}" registered successfully! Redirecting to POS...`);
      setTimeout(() => {
        this.router.navigate(['/pos']);
      }, 700);
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
      const email = this.pendingVerificationEmail() || this.regEmail.trim().toLowerCase();
      const result = await this.authService.confirmCognitoSignUp(email, this.confirmCode.trim());

      if (result.success) {
        this.successMessage.set('Verification successful! Redirecting to POS...');
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
    const email = this.pendingVerificationEmail() || this.regEmail.trim().toLowerCase();
    
    if (!email) return;

    this.isLoading.set(true);
    try {
      const res = await this.authService.resendCognitoCode(email);
      if (res.success) {
        this.successMessage.set(res.message || `New code sent to ${email}`);
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
