import { Component, signal, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faLock } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule, FontAwesomeModule],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent {
  private authService = inject(AuthService);

  password = signal<string>('');
  error = signal<string | null>(null);

  faLock = faLock;

  onLogin() {
    this.error.set(null);
    this.authService.login(this.password()).subscribe({
      error: (err) => {
        this.error.set('Invalid password');
      }
    });
  }
}
