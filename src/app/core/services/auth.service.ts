import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, catchError, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  isAuthenticated = signal<boolean>(this.checkInitialAuth());

  private checkInitialAuth(): boolean {
    const token = localStorage.getItem('auth_token');
    const expiry = localStorage.getItem('auth_expiry');
    
    if (!token || !expiry) return false;
    
    if (Date.now() > parseInt(expiry)) {
      this.logout();
      return false;
    }
    
    return true;
  }

  login(password: string) {
    return this.http.post<{token: string, expiry: number}>('/api/auth/login', { password }).pipe(
      tap(res => {
        localStorage.setItem('auth_token', res.token);
        localStorage.setItem('auth_expiry', res.expiry.toString());
        this.isAuthenticated.set(true);
      })
    );
  }

  changePassword(oldPassword: string, newPassword: string) {
    return this.http.post<{success: boolean}>('/api/auth/change-password', { oldPassword, newPassword });
  }

  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_expiry');
    this.isAuthenticated.set(false);
    // Force reload to clear all states/services
    window.location.reload();
  }
}
