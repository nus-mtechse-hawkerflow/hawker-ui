import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BackendOrderSubmissionPayload,
  BackendStallOrdersResponseDto
} from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class OrderApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.orderApiUrl || 'http://localhost:8082/hawkerflow';

  private createHeaders(stallId?: number | string): HttpHeaders {
    let headers = new HttpHeaders();
    if (stallId !== undefined && stallId !== null) {
      headers = headers.set('X-Stall-ID', String(stallId));
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  /**
   * Fetch all orders for a specific stall ID.
   * GET /v1/order/stalls/{stall_id}/orders
   */
  async getStallOrders(stallId: number, status?: string): Promise<BackendStallOrdersResponseDto> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    const headers = this.createHeaders(stallId);

    return firstValueFrom(
      this.http.get<BackendStallOrdersResponseDto>(
        `${this.baseUrl}/v1/order/stalls/${stallId}/orders`,
        { headers, params }
      )
    );
  }

  /**
   * Fetch all orders belonging to authenticated stall.
   * GET /v1/order/stalls/me/orders
   */
  async getMyStallOrders(stallId?: number, status?: string): Promise<BackendStallOrdersResponseDto> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    const headers = this.createHeaders(stallId);

    return firstValueFrom(
      this.http.get<BackendStallOrdersResponseDto>(
        `${this.baseUrl}/v1/order/stalls/me/orders`,
        { headers, params }
      )
    );
  }

  /**
   * Update stall order status (e.g. PREPARING, READY, COMPLETED, CANCELLED)
   * for dishes belonging to their stall in the specified order.
   * PATCH /v1/order/stalls/{stall_id}/orders/{order_id}
   */
  async updateStallOrderStatus(
    stallId: number,
    orderId: number,
    status: string
  ): Promise<any> {
    const headers = this.createHeaders(stallId);
    return firstValueFrom(
      this.http.patch<any>(
        `${this.baseUrl}/v1/order/stalls/${stallId}/orders/${orderId}`,
        { status },
        { headers }
      )
    );
  }

  /**
   * General order status update (updates overall customer order status).
   * PUT /v1/order/orders/update
   */
  async updateOrderStatus(orderId: number, status: string): Promise<any> {
    const headers = this.createHeaders();
    return firstValueFrom(
      this.http.put<any>(
        `${this.baseUrl}/v1/order/orders/update`,
        { order_id: orderId, status },
        { headers }
      )
    );
  }

  /**
   * Submit an order to the order service.
   * POST /v1/order/orders
   */
  async submitOrder(payload: BackendOrderSubmissionPayload): Promise<any> {
    const headers = this.createHeaders();
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}/v1/order/orders`, payload, { headers })
    );
  }

  /**
   * Get specific order by ID.
   * GET /v1/order/orders/{order_id}
   */
  async getOrder(orderId: number): Promise<any> {
    const headers = this.createHeaders();
    return firstValueFrom(
      this.http.get<any>(`${this.baseUrl}/v1/order/orders/${orderId}`, { headers })
    );
  }
}
