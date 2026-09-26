import { Injectable, inject, signal } from '@angular/core';
import { Subject, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { AnalyticsApiService } from './analytics-api.service';
import { AnalyticsStatus, StallDaySummary } from '../models/analytics.model';
import { StallAccount } from '../models/auth.model';

interface LoadRequest {
  stallId: number;
  isoDate: string;
}

/**
 * Analytics state.
 *
 * This service used to derive every figure with computed() over
 * OrderService.orders. That had two problems: the numbers only reflected the
 * orders loaded in the current browser tab (and the analytics screen never
 * fetched any, so it usually showed zeros), and four of the metrics were
 * hardcoded constants rather than measurements.
 *
 * It is now a fetch state machine over hawkerflow-service-analytics, which
 * computes the same figures in PostgreSQL from persisted orders.
 */
@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private api = inject(AnalyticsApiService);
  private requests = new Subject<LoadRequest>();

  readonly summary = signal<StallDaySummary | null>(null);
  readonly status = signal<AnalyticsStatus>('idle');
  readonly errorMessage = signal<string | null>(null);
  readonly selectedDate = signal<string>(this.singaporeToday());

  private lastRequest: LoadRequest | null = null;

  constructor() {
    // switchMap cancels the in-flight request whenever a new one starts, so a
    // slow response for a previously selected stall or date can never
    // overwrite the figures currently on screen.
    this.requests
      .pipe(
        switchMap(req =>
          this.api.getStallDaySummary(req.stallId, req.isoDate).pipe(
            tap(result => {
              this.summary.set(result);
              this.status.set('ready');
              this.errorMessage.set(null);
            }),
            catchError(() => {
              // Never fall back to browser-computed figures: a wrong number
              // shown confidently is worse than no number.
              this.summary.set(null);
              this.status.set('error');
              this.errorMessage.set(
                'Analytics is unavailable. The figures cannot be shown right now.'
              );
              return of(null);
            })
          )
        )
      )
      .subscribe();
  }

  /** Today on the Singapore calendar, whatever the device timezone. */
  singaporeToday(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(new Date());
  }

  load(stallId: number, isoDate: string): void {
    this.lastRequest = { stallId, isoDate };
    this.status.set('loading');
    this.errorMessage.set(null);
    this.requests.next(this.lastRequest);
  }

  /**
   * Load for a signed-in stall. A stall with no backend id shows a setup
   * message rather than defaulting to another stall's figures.
   */
  loadForStall(stall: StallAccount | null | undefined, isoDate: string): void {
    const stallId = this.api.resolveStallId(stall);

    if (stallId === null) {
      this.summary.set(null);
      this.status.set('unmapped');
      this.errorMessage.set(
        'This stall has no backend id, so analytics cannot be loaded. Sign in again to refresh it.'
      );
      return;
    }

    this.load(stallId, isoDate);
  }

  setDate(isoDate: string): void {
    this.selectedDate.set(isoDate);

    if (this.lastRequest) {
      this.load(this.lastRequest.stallId, isoDate);
    }
  }

  retry(): void {
    if (this.lastRequest) {
      this.load(this.lastRequest.stallId, this.lastRequest.isoDate);
    }
  }
}
