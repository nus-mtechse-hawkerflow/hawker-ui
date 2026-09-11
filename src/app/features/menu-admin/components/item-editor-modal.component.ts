import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuItem } from '../../../core/models/menu.model';
import { MenuService } from '../../../core/services/menu.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-item-editor-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './item-editor-modal.component.html'
})
export class ItemEditorModalComponent implements OnInit, OnChanges {
  @Input() item: MenuItem | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<MenuItem>();

  private menuService = inject(MenuService);
  readonly categories = this.menuService.categories;

  isEditing = false;
  name = '';
  chineseName = '';
  description = '';
  categoryId = 'mains';
  basePrice = 5.00;
  emoji = '🍛';
  popularBadge = '';
  preparationTimeMins = 3;
  isAvailable = true;

  ngOnInit(): void {
    this.populate();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['item']) {
      this.populate();
    }
  }

  populate(): void {
    if (this.item) {
      this.isEditing = true;
      this.name = this.item.name;
      this.chineseName = this.item.chineseName || '';
      this.description = this.item.description || '';
      this.categoryId = this.item.categoryId;
      this.basePrice = this.item.basePrice;
      this.emoji = this.item.emoji || '🍛';
      this.popularBadge = this.item.popularBadge || '';
      this.preparationTimeMins = this.item.preparationTimeMins || 3;
      this.isAvailable = this.item.isAvailable;
    } else {
      this.isEditing = false;
      this.name = '';
      this.chineseName = '';
      this.description = '';
      this.categoryId = 'mains';
      this.basePrice = 5.00;
      this.emoji = '🍛';
      this.popularBadge = '';
      this.preparationTimeMins = 3;
      this.isAvailable = true;
    }
  }

  onSave(): void {
    if (!this.name || this.basePrice <= 0) return;

    const saved: MenuItem = {
      id: this.item ? this.item.id : 'dish-' + Date.now(),
      name: this.name.trim(),
      chineseName: this.chineseName.trim() || undefined,
      description: this.description.trim(),
      categoryId: this.categoryId,
      basePrice: Number(this.basePrice),
      emoji: this.emoji.trim() || '🍛',
      popularBadge: this.popularBadge.trim() || undefined,
      preparationTimeMins: Number(this.preparationTimeMins) || 3,
      isAvailable: this.isAvailable,
      modifierGroups: this.item ? this.item.modifierGroups : []
    };

    this.save.emit(saved);
  }
}
