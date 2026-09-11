import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuGridComponent } from './components/menu-grid.component';
import { CartComponent } from './components/cart.component';
import { ModifierModalComponent } from './components/modifier-modal.component';
import { PaymentModalComponent } from './components/payment-modal.component';
import { ReceiptModalComponent } from '../../shared/components/receipt-modal/receipt-modal.component';
import { OrderService } from '../../core/services/order.service';
import { MenuItem } from '../../core/models/menu.model';
import { Order, PaymentMethod, SelectedModifier } from '../../core/models/order.model';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [
    CommonModule,
    MenuGridComponent,
    CartComponent,
    ModifierModalComponent,
    PaymentModalComponent,
    ReceiptModalComponent,
    IconComponent
  ],
  templateUrl: './pos.component.html'
})
export class PosComponent {
  private orderService = inject(OrderService);

  readonly cartTotal = this.orderService.cartTotal;
  readonly selectedItemForModifier = signal<MenuItem | null>(null);
  readonly showPaymentModal = signal<boolean>(false);
  readonly recentOrderForReceipt = signal<Order | null>(null);
  readonly showSuccessBanner = signal<boolean>(false);
  readonly lastOrderNumber = signal<string>('');

  private lastCreatedOrder: Order | null = null;

  onItemSelect(item: MenuItem): void {
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      this.selectedItemForModifier.set(item);
    } else {
      this.orderService.addToCart(item, [], 1);
    }
  }

  onAddCustomizedItem(event: {
    item: MenuItem;
    selectedModifiers: SelectedModifier[];
    quantity: number;
    specialNotes: string;
  }): void {
    this.orderService.addToCart(
      event.item,
      event.selectedModifiers,
      event.quantity,
      event.specialNotes
    );
  }

  openPaymentModal(): void {
    this.showPaymentModal.set(true);
  }

  onPaymentComplete(event: {
    method: PaymentMethod;
    cashTendered?: number;
    paynowRef?: string;
  }): void {
    this.showPaymentModal.set(false);
    const order = this.orderService.submitOrder(
      event.method,
      event.cashTendered,
      event.paynowRef
    );

    this.lastCreatedOrder = order;
    this.lastOrderNumber.set(order.orderNumber);
    this.showSuccessBanner.set(true);

    setTimeout(() => {
      this.showSuccessBanner.set(false);
    }, 6000);
  }

  viewLastReceipt(): void {
    if (this.lastCreatedOrder) {
      this.recentOrderForReceipt.set(this.lastCreatedOrder);
      this.showSuccessBanner.set(false);
    }
  }
}
