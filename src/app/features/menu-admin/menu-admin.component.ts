import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuService } from '../../core/services/menu.service';
import { MenuItem } from '../../core/models/menu.model';
import { ItemEditorModalComponent } from './components/item-editor-modal.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-menu-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ItemEditorModalComponent, IconComponent],
  templateUrl: './menu-admin.component.html'
})
export class MenuAdminComponent {
  private menuService = inject(MenuService);

  readonly categories = this.menuService.categories;
  readonly items = this.menuService.items;

  selectedCategory = signal<string>('all');
  showEditorModal = signal<boolean>(false);
  editingItem = signal<MenuItem | null>(null);

  readonly displayedItems = computed(() => {
    const cat = this.selectedCategory();
    const list = this.items();
    if (cat === 'all') return list;
    return list.filter(i => i.categoryId === cat);
  });

  toggleStock(itemId: string): void {
    this.menuService.toggle86(itemId);
  }

  openAddModal(): void {
    this.editingItem.set(null);
    this.showEditorModal.set(true);
  }

  openEditModal(item: MenuItem): void {
    this.editingItem.set(item);
    this.showEditorModal.set(true);
  }

  onSaveItem(savedItem: MenuItem): void {
    if (this.editingItem()) {
      this.menuService.updateItem(savedItem.id, savedItem);
    } else {
      this.menuService.addItem(savedItem);
    }
    this.showEditorModal.set(false);
  }

  deleteDish(item: MenuItem): void {
    if (confirm(`Are you sure you want to remove "${item.name}" from the menu?`)) {
      this.menuService.deleteItem(item.id);
    }
  }

  resetMenu(): void {
    if (confirm('Reset menu items and categories back to factory defaults?')) {
      this.menuService.resetToDefaultMenu();
    }
  }
}
