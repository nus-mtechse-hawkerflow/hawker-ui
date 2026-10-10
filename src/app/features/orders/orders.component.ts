import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../core/services/order.service';
import { Order, OrderStatus, PaymentMethod } from '../../core/models/order.model';
import { ReceiptModalComponent } from '../../shared/components/receipt-modal/receipt-modal.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, ReceiptModalComponent, IconComponent],
  templateUrl: './orders.component.html'
})
export class OrdersComponent {
  private orderService = inject(OrderService);

  readonly allOrders = this.orderService.orders;
  readonly isSyncing = this.orderService.isSyncingOrders;
  readonly lastNotificationMessage = this.orderService.lastNotificationMessage;

  searchQuery = '';
  statusFilter: string = 'all';
  paymentFilter: string = 'all';

  selectedOrderForReceipt = signal<Order | null>(null);

  readonly filteredOrders = computed(() => {
    const list = this.allOrders();
    const query = this.searchQuery.trim().toLowerCase();
    const status = this.statusFilter;
    const payment = this.paymentFilter;

    return list.filter(order => {
      const matchStatus = status === 'all' || order.status === status;
      const matchPayment = payment === 'all' || order.paymentMethod === payment;
      
      const matchQuery = !query ||
        order.orderNumber.toLowerCase().includes(query) ||
        (order.tableOrBuzzerNumber && order.tableOrBuzzerNumber.toLowerCase().includes(query)) ||
        (order.paynowRef && order.paynowRef.toLowerCase().includes(query)) ||
        order.items.some(i => i.name.toLowerCase().includes(query) || (i.chineseName && i.chineseName.toLowerCase().includes(query)));

      return matchStatus && matchPayment && matchQuery;
    });
  });

  formatTime(isoString: string): string {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  openReceipt(order: Order): void {
    this.selectedOrderForReceipt.set(order);
  }

  onUpdateStatus(order: Order, newStatus: string): void {
    if (newStatus === order.status) return;
    this.orderService.updateOrderStatus(order.id, newStatus as OrderStatus);
  }

  onNotifyReady(order: Order): void {
    this.orderService.updateOrderStatus(order.id, 'ready', `Order ${order.orderNumber} marked READY • Customer notified via Backend 8082!`);
  }

  refreshOrders(): void {
    this.orderService.syncBackendOrders();
  }

  promptCancel(order: Order): void {
    const reason = prompt(`Void / Refund order ${order.orderNumber}? Please enter reason:`, 'Customer cancelled');
    if (reason) {
      this.orderService.cancelOrder(order.id, reason);
    }
  }
}

