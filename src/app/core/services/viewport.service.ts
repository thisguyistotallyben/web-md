import { Injectable, signal, NgZone, inject } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ViewportService {
  private ngZone = inject(NgZone);
  
  // Track current keyboard height
  keyboardHeight = signal<number>(0);

  constructor() {
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        this.ngZone.run(() => this.updateKeyboardHeight());
      });
      // Also listen for scroll which can happen on iOS
      window.visualViewport.addEventListener('scroll', () => {
        this.ngZone.run(() => this.updateKeyboardHeight());
      });
      this.updateKeyboardHeight();
    }
  }

  private updateKeyboardHeight() {
    const vv = window.visualViewport;
    if (!vv) return;

    const currentHeight = vv.height;
    const keyboardHeight = window.innerHeight - vv.height;
    
    document.documentElement.style.setProperty('--visual-height', `${currentHeight}px`);
    document.documentElement.style.setProperty('--keyboard-height', `${Math.max(0, keyboardHeight)}px`);

    // Nuclear option: Force the browser back to the top to prevent the "shifted UI" look.
    // We do this twice to ensure different browser engines (iOS/Chrome) respect it.
    if (keyboardHeight > 0) {
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
    }
  }
}
