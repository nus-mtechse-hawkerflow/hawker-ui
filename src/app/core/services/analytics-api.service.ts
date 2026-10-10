import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StallDaySummary } from '../models/analytics.model';
import { StallAccount, UserSession } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.analyticsApiUrl;

  /**
   * Fetch one stall's figures for one Singapore day.
   * GET /v1/insights/stalls/{stallId}/summary?date=YYYY-MM-DD
   *
   * The path says "insights" because ad and tracker blockers refuse browser
   * requests to anything under /analytics/.
   *
   * Returns an Observable rather than a Promise, unlike OrderApiService: the
   * caller needs switchMap to cancel a stale request, so that a slow response
   * for a previously selected stall or date cannot overwrite the current one.
   */
  getStallDaySummary(stallId: number, isoDate: string): Observable<StallDaySummary> {
    const headers = new HttpHeaders().set('X-Stall-ID', String(stallId));
    const params = new HttpParams().set('date', isoDate);

    return this.http.get<StallDaySummary>(
      `${this.baseUrl}/v1/insights/stalls/${stallId}/summary`,
      { headers, params }
    );
  }

  /**
   * Resolve the backend stall id for the signed-in stall.
   *
   * Prefers StallAccount.numericId, then the session's numericStallId. Both
   * originate from backendStall.stall_id, so both are authoritative rather
   * than guesses.
   *
   * The session fallback matters because AuthService.currentStall resolves
   * against allStalls(), which is populated only by a fetch from the hawker
   * service. When that service is down, currentStall() is null even for a
   * validly signed-in user — but the session, restored from localStorage,
   * still carries the id. Analytics needs no other part of the hawker
   * service, so it should not go blank when that service is unavailable.
   *
   * Returns null when neither is present. A stall without an id must show a
   * setup message: guessing would show one stall another stall's takings.
   */
  resolveStallId(
    stall: Pick<StallAccount, 'numericId'> | null | undefined,
    session?: Pick<UserSession, 'numericStallId'> | null
  ): number | null {
    return stall?.numericId ?? session?.numericStallId ?? null;
  }
}
