import { Injectable, signal } from '@angular/core';

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

  open(config: ModalConfig) {
    this.config.set(config);
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
    this.config.set(null);
  }
}
