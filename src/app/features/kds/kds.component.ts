import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../core/services/order.service';
import { TicketCardComponent } from './components/ticket-card.component';
import { OrderStatus } from '../../core/models/order.model';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-kds',
  standalone: true,
  imports: [CommonModule, TicketCardComponent, IconComponent],
  templateUrl: './kds.component.html'
})
export class KdsComponent {
  private orderService = inject(OrderService);

  readonly allActiveOrders = this.orderService.activeOrders;
  readonly pendingOrders = this.orderService.kdsPendingOrders;
  readonly preparingOrders = this.orderService.kdsPreparingOrders;
  readonly readyOrders = this.orderService.kdsReadyOrders;
  readonly lastBumpedOrder = this.orderService.lastBumpedOrder;
  readonly isSyncing = this.orderService.isSyncingOrders;
  readonly isPolling = this.orderService.isPollingPendingOrders;
  readonly lastNotificationMessage = this.orderService.lastNotificationMessage;

  currentFilter = signal<'all' | 'pending' | 'preparing' | 'ready'>('all');

  readonly displayedOrders = computed(() => {
    const filter = this.currentFilter();
    if (filter === 'pending') return this.pendingOrders();
    if (filter === 'preparing') return this.preparingOrders();
    if (filter === 'ready') return this.readyOrders();
    return this.allActiveOrders();
  });

  onAdvanceStatus(event: { orderId: string; status: OrderStatus }): void {
    this.orderService.updateOrderStatus(event.orderId, event.status);
  }

  recallLastBumped(): void {
    this.orderService.recallLastBumpedOrder();
  }

  refreshOrders(): void {
    this.orderService.syncBackendOrders();
  }
}

