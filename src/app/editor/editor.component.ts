import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss'],
  encapsulation: ViewEncapsulation.None, // Allow styles to affect marked output
})
export class EditorComponent {
  isRawMode = signal<boolean>(false);
  
  markdownContent = signal<string>(`# Welcome to Web-MD
  
This is a simple markdown editor.

## Features
* **Live formatting:** Toggle between raw and formatted views.
* *Dark theme:* Inspired by OpusWing.
* Secure: Uses \`dompurify\` to prevent XSS.

> Try typing some markdown here!

---
Enjoy your notes.`);

  sanitizedHtml = computed(() => {
    const rawHtml = marked.parse(this.markdownContent()) as string;
    return DOMPurify.sanitize(rawHtml);
  });

  toggleMode() {
    this.isRawMode.update(mode => !mode);
  }
}
