import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { AuthComponent } from './features/auth/auth.component';
import { AuthService } from './core/services/auth.service';
import { ViewportService } from './core/services/viewport.service';
import { RealtimeService } from './core/services/realtime.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MainLayoutComponent, AuthComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'web-md';
  public authService = inject(AuthService);
  private viewportService = inject(ViewportService);
  private realtimeService = inject(RealtimeService);
}
