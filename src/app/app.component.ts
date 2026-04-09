import { Component, inject, HostListener } from '@angular/core';

import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { AuthComponent } from './features/auth/auth.component';
import { AuthService } from './core/services/auth.service';
import { ViewportService } from './core/services/viewport.service';
import { RealtimeService } from './core/services/realtime.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MainLayoutComponent, AuthComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'web-md';
  public authService = inject(AuthService);
  private viewportService = inject(ViewportService);
  private realtimeService = inject(RealtimeService);

  @HostListener('window:scroll', ['$event'])
  onWindowScroll(event: Event) {
    // If the window scrolls (likely due to mobile focus), snap it back instantly
    if (window.scrollY !== 0 || window.scrollX !== 0) {
      window.scrollTo(0, 0);
    }
  }
}
