import { Component, OnDestroy, ViewEncapsulation, signal, computed, inject, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { FileService } from '../core/services/file.service';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, TiptapEditorDirective],
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class EditorComponent implements OnInit, OnDestroy {
  private fileService = inject(FileService);

  isSettingsOpen = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  isRenaming = signal<boolean>(false);
  isActionMenuOpen = signal<boolean>(false);
  activeFilePath = signal<string | null>(null);
  activeFileName = signal<string>('Welcome');
  
  displayFileName = computed(() => this.activeFileName().replace('.md', ''));

  private saveSubject = new Subject<string>();

  editor = new Editor({
    extensions: [StarterKit, Markdown],
    content: '<h1>Welcome to WebMD</h1><p>Select a note from the sidebar to start editing.</p>',
    onUpdate: ({ editor }) => {
      const path = this.activeFilePath();
      console.log('Tiptap Update - Path:', path);
      if (path) {
        try {
          const markdown = (editor as any).getMarkdown();
          console.log('Markdown Length:', markdown.length);
          this.saveSubject.next(markdown);
        } catch (e) {
          console.error('Error getting markdown:', e);
        }
      }
    }
  });

  ngOnInit() {
    // Set up debounced autosave (save 500ms after last keystroke)
    this.saveSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(markdown => {
      const path = this.activeFilePath();
      console.log('Save Triggered - Path:', path);
      if (path) {
        this.isSaving.set(true);
        this.fileService.write(path, markdown).subscribe({
          next: () => {
            console.log('Save Successful');
            setTimeout(() => this.isSaving.set(false), 300);
          },
          error: (err) => {
            console.error('Save Failed:', err);
            this.isSaving.set(false);
          }
        });
      }
    });
  }

  @HostListener('window:open-note', ['$event'])
  onOpenNote(event: any) {
    const filePath = event.detail;
    console.log('Open Note Requested:', filePath);
    this.fileService.read(filePath).subscribe({
      next: (data) => {
        console.log('File Read Success - Length:', data.content.length);
        this.activeFilePath.set(filePath);
        this.activeFileName.set(filePath.split('/').pop() || 'Untitled');
        // We don't want the initial load to trigger a save
        // Standard signature for official @tiptap/markdown:
        this.editor.commands.setContent(data.content, { 
          emitUpdate: false, 
          contentType: 'markdown' 
        } as any);
        this.editor.commands.focus();
      },
      error: (err) => console.error('File Read Failed:', err)
    });
  }

  startRename() {
    if (this.activeFilePath()) {
      this.isRenaming.set(true);
    }
  }

  finishRename(newName: string) {
    const oldPath = this.activeFilePath();
    if (oldPath && newName.trim() && newName !== this.displayFileName()) {
      const parentPath = oldPath.split('/').slice(0, -1).join('/');
      const newFileName = newName.endsWith('.md') ? newName : `${newName}.md`;
      const newPath = parentPath ? `${parentPath}/${newFileName}` : newFileName;

      this.fileService.rename(oldPath, newFileName).subscribe(() => {
        this.activeFilePath.set(newPath);
        this.activeFileName.set(newFileName);
        this.isRenaming.set(false);
        // Refresh sidebar
        window.dispatchEvent(new CustomEvent('refresh-sidebar'));
      });
    } else {
      this.isRenaming.set(false);
    }
  }

  handleRenameKeydown(event: KeyboardEvent, input: HTMLInputElement) {
    if (event.key === 'Enter') this.finishRename(input.value);
    else if (event.key === 'Escape') this.isRenaming.set(false);
  }

  deleteActiveNote() {
    const path = this.activeFilePath();
    if (path && confirm(`Are you sure you want to delete "${this.displayFileName()}"?`)) {
      this.fileService.delete(path).subscribe(() => {
        this.activeFilePath.set(null);
        this.activeFileName.set('Welcome');
        this.editor.commands.setContent('<h1>Welcome to WebMD</h1><p>Select a note from the sidebar to start editing.</p>');
        this.isActionMenuOpen.set(false);
        window.dispatchEvent(new CustomEvent('refresh-sidebar'));
      });
    }
  }

  ngOnDestroy(): void {
    this.editor.destroy();
    this.saveSubject.complete();
  }
}
