import { Component, OnDestroy, ViewEncapsulation, signal, computed, inject, HostListener, OnInit, effect, ElementRef, ViewChild } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { FileService } from '../core/services/file.service';
import { RealtimeService } from '../core/services/realtime.service';
import { ViewportService } from '../core/services/viewport.service';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEllipsisV, faTrash, faFileAlt, faBold, faItalic, faHeading, faRemoveFormat, faQuoteRight, faCode } from '@fortawesome/free-solid-svg-icons';

import { all, createLowlight } from 'lowlight';

const lowlight = createLowlight(all);

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [FormsModule, TiptapEditorDirective, FontAwesomeModule],
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class EditorComponent implements OnInit, OnDestroy {
  private fileService = inject(FileService);
  private realtimeService = inject(RealtimeService);
  private viewportService = inject(ViewportService);

  @ViewChild('editorBody') editorBody!: ElementRef<HTMLDivElement>;

  // Icons
  faEllipsisV = faEllipsisV;
  faTrash = faTrash;
  faFileAlt = faFileAlt;
  faBold = faBold;
  faItalic = faItalic;
  faHeading = faHeading;
  faRemoveFormat = faRemoveFormat;
  faQuoteRight = faQuoteRight;
  faCode = faCode;

  isSettingsOpen = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  isRenaming = signal<boolean>(false);
  isActionMenuOpen = signal<boolean>(false);
  isHeaderCollapsed = this.viewportService.isHeaderCollapsed;
  activeFilePath = signal<string | null>(null);
  activeFileName = signal<string>('Welcome');
  
  displayFileName = computed(() => this.activeFileName().replace('.md', ''));

  private saveSubject = new Subject<string>();
  private lastTypingTime = 0;
  private lastScrollTop = 0;

  constructor() {
    // Automatically scroll cursor to top when keyboard height changes
    effect(() => {
      const height = this.viewportService.keyboardHeight();
      if (height > 0 && this.editor) {
        console.log('[Editor] Keyboard opened, forcing selection to top...');
        setTimeout(() => this.scrollToSelection(), 100);
      }
    });
  }

  private scrollToSelection() {
    if (!this.editor || !this.editorBody) return;

    const { view } = this.editor;
    const { selection } = view.state;
    
    // Get the pixel position of the cursor
    const coords = view.coordsAtPos(selection.from);
    const containerRect = this.editorBody.nativeElement.getBoundingClientRect();
    
    // Calculate the relative scroll position
    const relativeTop = coords.top - containerRect.top;
    const currentScroll = this.editorBody.nativeElement.scrollTop;
    
    // Target position: 100px from the top header
    const targetScroll = currentScroll + relativeTop - 100;

    this.editorBody.nativeElement.scrollTo({
      top: targetScroll,
      behavior: 'smooth'
    });
  }

  onScroll(event: Event) {
    const target = event.target as HTMLElement;
    const scrollTop = target.scrollTop;
    const isMobile = window.innerWidth <= 768;

    if (!isMobile) {
      this.isHeaderCollapsed.set(false);
      return;
    }

    // Threshold to prevent flickering
    if (Math.abs(scrollTop - this.lastScrollTop) < 10) return;

    if (scrollTop > this.lastScrollTop && scrollTop > 60) {
      // Scrolling down
      this.isHeaderCollapsed.set(true);
    } else if (scrollTop < this.lastScrollTop) {
      // Scrolling up
      this.isHeaderCollapsed.set(false);
    }

    this.lastScrollTop = scrollTop;
  }

  editor = new Editor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Markdown,
      CodeBlockLowlight.configure({
        lowlight,
      }),
    ],
    content: '<h1>Welcome to WebMD</h1><p>Select a note from the sidebar to start editing.</p>',
    onUpdate: ({ editor }) => {
      this.lastTypingTime = Date.now();
      const path = this.activeFilePath();
      if (path) {
        try {
          const markdown = (editor as any).getMarkdown();
          this.saveSubject.next(markdown);
        } catch (e) {
          console.error('Error getting markdown:', e);
        }
      }
    }
  });

  ngOnInit() {
    // Listen for remote updates
    this.realtimeService.fileUpdated.subscribe(data => {
      const currentPath = this.activeFilePath();
      const timeSinceLastType = Date.now() - this.lastTypingTime;
      
      if (currentPath === data.path && timeSinceLastType > 1000) {
        this.fileService.read(data.path).subscribe(res => {
          this.editor.commands.setContent(res.content, { 
            emitUpdate: false, 
            contentType: 'markdown' 
          } as any);
        });
      }
    });

    // Set up debounced autosave
    this.saveSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(markdown => {
      const path = this.activeFilePath();
      if (path) {
        this.isSaving.set(true);
        this.fileService.write(path, markdown).subscribe({
          next: () => {
            setTimeout(() => this.isSaving.set(false), 300);
          },
          error: () => {
            this.isSaving.set(false);
          }
        });
      }
    });
  }

  @HostListener('window:open-note', ['$event'])
  onOpenNote(event: any) {
    const filePath = event.detail;
    this.fileService.read(filePath).subscribe({
      next: (data) => {
        this.activeFilePath.set(filePath);
        this.activeFileName.set(filePath.split('/').pop() || 'Untitled');
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

  // Formatting Commands
  toggleBold() { this.editor.chain().focus().toggleBold().run(); }
  toggleItalic() { this.editor.chain().focus().toggleItalic().run(); }
  toggleHeading(level: any) { this.editor.chain().focus().toggleHeading({ level }).run(); }
  toggleBlockquote() { this.editor.chain().focus().toggleBlockquote().run(); }
  toggleCodeBlock() { this.editor.chain().focus().toggleCodeBlock().run(); }
  clearFormatting() { this.editor.chain().focus().unsetAllMarks().clearNodes().run(); }

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
