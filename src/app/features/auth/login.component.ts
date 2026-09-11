import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { StallAccount } from '../../core/models/auth.model';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  readonly allStalls = this.authService.allStalls;

  activeTab = signal<'quick' | 'login' | 'register'>('quick');
  errorMessage = signal<string>('');

  // Login Form
  loginIdentifier = 'ahhuat@maxwell.sg';
  loginPassword = 'password123';

  // Register Form
  regStallName = '';
  regHawkerCentre = '';
  regUnitNumber = '';
  regOwnerName = '';
  regEmail = '';
  regEmoji = '🥘';
  regCuisine = 'Hawker Specialties';

  onQuickLogin(stallId: string): void {
    this.authService.quickLogin(stallId);
  }

  onFormLogin(): void {
    this.errorMessage.set('');
    const res = this.authService.login(this.loginIdentifier, this.loginPassword);
    if (!res.success) {
      this.errorMessage.set(res.error || 'Login failed');
    }
  }

  onRegisterStall(): void {
    if (!this.regStallName || !this.regHawkerCentre || !this.regUnitNumber || !this.regOwnerName || !this.regEmail) {
      return;
    }

    this.authService.registerStall({
      stallName: this.regStallName.trim(),
      hawkerCentreName: this.regHawkerCentre.trim(),
      unitNumber: this.regUnitNumber.trim(),
      uenNumber: '2024' + Math.floor(10000 + Math.random() * 90000) + 'X',
      contactNumber: '+65 9123 0000',
      ownerName: this.regOwnerName.trim(),
      email: this.regEmail.trim(),
      password: 'password123',
      emoji: this.regEmoji.trim() || '🥘',
      cuisineCategory: this.regCuisine.trim() || 'Hawker Specialties',
      settings: {} as any
    });
  }
}
