import { Component, signal, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faLock, faUser } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule, FontAwesomeModule],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent {
  private authService = inject(AuthService);

  username = signal<string>('');
  password = signal<string>('');
  error = signal<string | null>(null);

  faLock = faLock;
  faUser = faUser;

  onLogin() {
    const success = this.authService.login(this.username(), this.password());
    if (!success) {
      this.error.set('Invalid username or password');
    }
  }
}
