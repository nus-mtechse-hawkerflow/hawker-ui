import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StallDaySummary } from '../models/analytics.model';
import { StallAccount } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.analyticsApiUrl;

  /**
   * Fetch one stall's figures for one Singapore day.
   * GET /v1/analytics/stalls/{stallId}/summary?date=YYYY-MM-DD
   *
   * Returns an Observable rather than a Promise, unlike OrderApiService: the
   * caller needs switchMap to cancel a stale request, so that a slow response
   * for a previously selected stall or date cannot overwrite the current one.
   */
  getStallDaySummary(stallId: number, isoDate: string): Observable<StallDaySummary> {
    const headers = new HttpHeaders().set('X-Stall-ID', String(stallId));
    const params = new HttpParams().set('date', isoDate);

    return this.http.get<StallDaySummary>(
      `${this.baseUrl}/v1/analytics/stalls/${stallId}/summary`,
      { headers, params }
    );
  }

  /**
   * Resolve the backend stall id for a signed-in stall.
   *
   * StallAccount.numericId is populated from backendStall.stall_id at login,
   * so it is authoritative. It is optional on the model, and a stall without
   * one must show a setup message rather than fall back to any default:
   * guessing here would show one stall another stall's takings.
   */
  resolveStallId(stall: Pick<StallAccount, 'numericId'> | null | undefined): number | null {
    return stall?.numericId ?? null;
  }
}
