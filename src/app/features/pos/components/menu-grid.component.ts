import { Component, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuService } from '../../../core/services/menu.service';
import { MenuItem } from '../../../core/models/menu.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-menu-grid',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './menu-grid.component.html'
})
export class MenuGridComponent {
  private menuService = inject(MenuService);

  readonly categories = this.menuService.categories;
  readonly items = this.menuService.filteredItems;
  readonly selectedCategoryId = this.menuService.selectedCategoryId;
  readonly searchQuery = this.menuService.searchQuery;

  @Output() itemSelect = new EventEmitter<MenuItem>();

  selectCategory(id: string): void {
    this.menuService.selectCategory(id);
  }

  onSearchChange(q: string): void {
    this.menuService.setSearchQuery(q);
  }

  clearSearch(): void {
    this.menuService.setSearchQuery('');
  }

  onItemClick(item: MenuItem): void {
    if (!item.isAvailable) return;
    this.itemSelect.emit(item);
  }
}
