import { Component, signal, inject, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { EditorComponent } from '../../editor/editor.component';

import { FormsModule } from '@angular/forms';
import { ModalService } from '../../core/services/modal.service';
import { SystemService } from '../../core/services/system.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBars, faChevronLeft, faPlus, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [FormsModule, SidebarComponent, EditorComponent, FontAwesomeModule],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent implements OnDestroy {
  public modalService = inject(ModalService);
  public systemService = inject(SystemService);
  
  @ViewChild('modalInput') modalInput!: ElementRef<HTMLInputElement>;
  private modalSub: Subscription;

  // Icons
  faBars = faBars;
  faChevronLeft = faChevronLeft;
  faPlus = faPlus;
  faExclamationTriangle = faExclamationTriangle;

  isSidebarCollapsed = signal<boolean>(false);
  modalValue = signal<string>('');

  constructor() {
    this.modalSub = this.modalService.opened.subscribe(() => {
      this.modalValue.set(this.modalService.config()?.value || '');
      if (this.modalInput) {
        this.modalInput.nativeElement.focus();
        this.modalInput.nativeElement.select();
      }
    });
  }

  ngOnDestroy() {
    this.modalSub.unsubscribe();
  }

  toggleSidebar() {
    this.isSidebarCollapsed.update(v => !v);
  }

  confirm() {
    const config = this.modalService.config();
    if (config) {
      config.onConfirm(this.modalValue());
      this.modalService.close();
    }
  }
}
