import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BackendHawkerRegisterPayload, BackendStallDto, HawkerMeStallDto } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class HawkerApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.hawkerApiUrl || 'http://localhost:8080/hawkerflow';

  /**
   * Register a new hawker stall along with their initial dishes.
   * POST /v1/hawker/register
   */
  async registerHawker(payload: BackendHawkerRegisterPayload): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}/v1/hawker/register`, payload)
    );
  }

  /**
   * Retrieve all registered hawker stalls with dishes and owners.
   * GET /v1/hawker/stalls
   */
  async getStalls(): Promise<{ stalls: BackendStallDto[] }> {
    return firstValueFrom(
      this.http.get<{ stalls: BackendStallDto[] }>(`${this.baseUrl}/v1/hawker/stalls`)
    );
  }

  /**
   * Retrieve stall and menu details for the currently authenticated hawker by their sub identifier.
   * GET /v1/hawker/me/stall/{hawker_sub}
   */
  async getHawkerStallBySub(hawkerSub: string): Promise<HawkerMeStallDto> {
    return firstValueFrom(
      this.http.get<HawkerMeStallDto>(`${this.baseUrl}/v1/hawker/me/stall/${encodeURIComponent(hawkerSub)}`)
    );
  }
}
