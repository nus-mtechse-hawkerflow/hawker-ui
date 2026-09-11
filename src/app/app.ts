import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header.component';
import { SettingsService } from './core/services/settings.service';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private settingsService = inject(SettingsService);
  private authService = inject(AuthService);

  readonly isAuthenticated = this.authService.isAuthenticated;

  ngOnInit(): void {
    // Initial theme check
    const isDark = this.settingsService.settings().isDarkTheme;
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  }
}
