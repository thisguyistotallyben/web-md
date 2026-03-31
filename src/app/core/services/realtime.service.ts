import { Injectable, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { ThemeService } from './theme.service';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RealtimeService {
  private themeService = inject(ThemeService);
  private socket: Socket;

  // Observable for file updates so components can listen
  fileUpdated = new Subject<{ path: string }>();

  constructor() {
    this.socket = io();

    this.socket.on('connect', () => {
      console.log('[Realtime] WebSocket Connected! ID:', this.socket.id);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[Realtime] WebSocket Connection Error:', err.message);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('[Realtime] WebSocket Disconnected:', reason);
    });

    this.socket.on('file-updated', (data: { path: string }) => {
      console.log('[Realtime] File updated remotely:', data.path);
      this.fileUpdated.next(data);
    });

    this.socket.on('fs-changed', () => {
      console.log('[Realtime] File system changed remotely');
      window.dispatchEvent(new CustomEvent('refresh-sidebar'));
    });

    this.socket.on('settings-updated', (settings: any) => {
      console.log('[Realtime] Settings updated remotely');
      if (settings.theme) {
        this.themeService.setTheme(settings.theme, false);
      }
    });
  }
}
