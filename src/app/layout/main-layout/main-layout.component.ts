import { Component, signal, inject } from '@angular/core';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { EditorComponent } from '../../editor/editor.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalService } from '../../core/services/modal.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, EditorComponent],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent {
  public modalService = inject(ModalService);
  isSidebarCollapsed = signal<boolean>(false);
  modalValue = signal<string>('');

  toggleSidebar() {
    this.isSidebarCollapsed.update(v => !v);
  }

  handleOpen() {
    this.modalValue.set(this.modalService.config()?.value || '');
  }

  confirm() {
    const config = this.modalService.config();
    if (config) {
      config.onConfirm(this.modalValue());
      this.modalService.close();
    }
  }
}
