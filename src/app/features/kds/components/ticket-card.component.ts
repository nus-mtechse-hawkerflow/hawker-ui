import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order, OrderStatus } from '../../../core/models/order.model';
import { SettingsService } from '../../../core/services/settings.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-ticket-card',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './ticket-card.component.html'
})
export class TicketCardComponent implements OnInit, OnDestroy {
  @Input() order!: Order;
  @Output() advanceStatus = new EventEmitter<{ orderId: string; status: OrderStatus }>();

  private settingsService = inject(SettingsService);
  private timerInterval: any;

  elapsedSeconds = signal<number>(0);

  ngOnInit(): void {
    this.updateElapsed();
    this.timerInterval = setInterval(() => this.updateElapsed(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  private updateElapsed(): void {
    if (!this.order) return;
    const startMs = new Date(this.order.createdAt).getTime();
    const nowMs = Date.now();
    const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
    this.elapsedSeconds.set(diffSec);
  }

  elapsedMinutes = computed(() => Math.floor(this.elapsedSeconds() / 60));

  elapsedFormatted = computed(() => {
    const mins = Math.floor(this.elapsedSeconds() / 60);
    const secs = this.elapsedSeconds() % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  });

  get urgency(): 'normal' | 'warning' | 'critical' {
    const mins = this.elapsedMinutes();
    const settings = this.settingsService.settings();
    if (mins >= settings.kdsCriticalThresholdMins) return 'critical';
    if (mins >= settings.kdsWarningThresholdMins) return 'warning';
    return 'normal';
  }

  get cardColorClasses(): string {
    if (this.urgency === 'critical') {
      return 'border-rose-500 dark:border-rose-600 shadow-rose-500/10';
    }
    if (this.urgency === 'warning') {
      return 'border-amber-400 dark:border-amber-600 shadow-amber-500/10';
    }
    return 'border-slate-200 dark:border-slate-800';
  }

  get headerColorClasses(): string {
    if (this.urgency === 'critical') {
      return 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800';
    }
    if (this.urgency === 'warning') {
      return 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800';
    }
    return 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800';
  }

  get orderNumberColorClass(): string {
    if (this.urgency === 'critical') return 'text-rose-600 dark:text-rose-400';
    if (this.urgency === 'warning') return 'text-amber-600 dark:text-amber-400';
    return 'text-slate-900 dark:text-white';
  }

  get timerBadgeClasses(): string {
    if (this.urgency === 'critical') {
      return 'bg-rose-600 text-white animate-pulse';
    }
    if (this.urgency === 'warning') {
      return 'bg-amber-500 text-slate-950 font-extrabold';
    }
    return 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
  }

  formatOrderTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
