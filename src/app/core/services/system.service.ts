import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval, switchMap, catchError, of, map, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SystemService {
  private http = inject(HttpClient);
  
  isServerOnline = signal<boolean>(true);
  isReconnecting = signal<boolean>(false);

  constructor() {
    this.startHeartbeat();
  }

  private startHeartbeat() {
    // Poll every 3 seconds
    interval(3000).pipe(
      switchMap(() => this.http.get<{ online: boolean }>('/api/system/heartbeat').pipe(
        map(res => res.online),
        catchError(() => of(false))
      ))
    ).subscribe(online => {
      const wasOffline = !this.isServerOnline() && online;
      
      this.isServerOnline.set(online);

      if (wasOffline) {
        // Server came back online!
        console.log('[System] Server is back online. Refreshing...');
        window.location.reload();
      }
    });
  }
}
