import { Component, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../core/services/order.service';
import { SettingsService } from '../../../core/services/settings.service';
import { DiningOption } from '../../../core/models/order.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './cart.component.html'
})
export class CartComponent {
  private orderService = inject(OrderService);

  readonly cartItems = this.orderService.cartItems;
  readonly diningOption = this.orderService.diningOption;
  readonly tableOrBuzzerNumber = this.orderService.tableOrBuzzerNumber;
  readonly subtotal = this.orderService.cartSubtotal;
  readonly takeawayFee = this.orderService.cartTakeawayFee;
  readonly tax = this.orderService.cartTax;
  readonly total = this.orderService.cartTotal;

  @Output() checkout = new EventEmitter<void>();

  setDiningOption(option: DiningOption): void {
    this.orderService.setDiningOption(option);
  }

  onTableOrBuzzerChange(val: string): void {
    this.orderService.setTableOrBuzzerNumber(val);
  }

  updateQty(cartItemId: string, delta: number): void {
    this.orderService.updateQuantity(cartItemId, delta);
  }

  removeItem(cartItemId: string): void {
    this.orderService.removeCartItem(cartItemId);
  }

  clearCart(): void {
    this.orderService.clearCart();
  }

  onCheckout(): void {
    if (this.cartItems().length === 0) return;
    this.checkout.emit();
  }
}
