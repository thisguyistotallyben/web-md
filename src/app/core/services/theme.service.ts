import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type Theme = 'dark' | 'light' | 'sepia' | 'sepia-dark' | 'high-contrast' | 'dark-hc' | 'gruvbox' | 'hotdog' | 'win98';

export interface AppSettings {
  theme: Theme;
  backupAWS?: boolean;
  backupFrequency?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private http = inject(HttpClient);
  currentTheme = signal<Theme>('dark');

  constructor() {
    // Try to load from localStorage for instant apply
    const savedTheme = localStorage.getItem('app_theme') as Theme;
    if (savedTheme) {
      this.setTheme(savedTheme, false);
    }
  }

  loadTheme() {
    // Public endpoint for pre-auth theme loading
    this.http.get<{theme: Theme}>('/api/theme').subscribe(res => {
      if (res && res.theme) {
        this.setTheme(res.theme, false);
      }
    });
  }

  loadSettings() {
    this.http.get<AppSettings>('/api/settings').subscribe(settings => {
      if (settings && settings.theme) {
        this.setTheme(settings.theme, false);
      }
    });
  }

  setTheme(theme: Theme, save: boolean = true) {
    // Remove all theme classes
    document.body.classList.remove('theme-light', 'theme-sepia', 'theme-sepia-dark', 'theme-high-contrast', 'theme-dark-hc', 'theme-gruvbox', 'theme-hotdog', 'theme-win98');
    
    // Add new class if needed
    if (theme === 'light') document.body.classList.add('theme-light');
    if (theme === 'sepia') document.body.classList.add('theme-sepia');
    if (theme === 'sepia-dark') document.body.classList.add('theme-sepia-dark');
    if (theme === 'high-contrast') document.body.classList.add('theme-high-contrast');
    if (theme === 'dark-hc') document.body.classList.add('theme-dark-hc');
    if (theme === 'gruvbox') document.body.classList.add('theme-gruvbox');
    if (theme === 'hotdog') document.body.classList.add('theme-hotdog');
    if (theme === 'win98') document.body.classList.add('theme-win98');
    
    this.currentTheme.set(theme);
    localStorage.setItem('app_theme', theme);

    if (save) {
      this.http.post('/api/settings', { theme }).subscribe();
    }
  }
}
