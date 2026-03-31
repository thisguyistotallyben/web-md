import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

export interface ModalConfig {
  title: string;
  placeholder: string;
  value: string;
  onConfirm: (value: string) => void;
}

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  isOpen = signal<boolean>(false);
  config = signal<ModalConfig | null>(null);
  opened = new Subject<void>();

  open(config: ModalConfig) {
    this.config.set(config);
    this.isOpen.set(true);
    // Use setTimeout to ensure the DOM has rendered before emitting
    setTimeout(() => this.opened.next(), 0);
  }

  close() {
    this.isOpen.set(false);
    this.config.set(null);
  }
}
