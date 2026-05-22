import { Component, signal, inject, HostListener, ViewChild, ElementRef, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileService, FileItem } from '../../core/services/file.service';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { ModalService } from '../../core/services/modal.service';
import { MainLayoutComponent } from '../main-layout/main-layout.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faSearch,
  faFileAlt,
  faFolder,
  faKeyboard,
  faTerminal,
  faAdjust,
  faTrash,
  faArrowRight,
  faPlus,
  faBars,
  faGear,
  faPowerOff,
  faQuestionCircle
} from '@fortawesome/free-solid-svg-icons';
import { firstValueFrom } from 'rxjs';

interface CommandItem {
  name: string;
  description: string;
  icon: any;
  action: () => void;
}

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule],
  templateUrl: './command-palette.component.html',
  styleUrls: ['./command-palette.component.scss']
})
export class CommandPaletteComponent {
  private fileService = inject(FileService);
  private themeService = inject(ThemeService);
  private authService = inject(AuthService);
  private modalService = inject(ModalService);
  private layout = inject(MainLayoutComponent);

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  // Icons
  faSearch = faSearch;
  faFileAlt = faFileAlt;
  faFolder = faFolder;
  faKeyboard = faKeyboard;
  faTerminal = faTerminal;
  faAdjust = faAdjust;
  faTrash = faTrash;
  faArrowRight = faArrowRight;
  faPlus = faPlus;
  faBars = faBars;
  faGear = faGear;
  faPowerOff = faPowerOff;
  faQuestionCircle = faQuestionCircle;

  isOpen = signal<boolean>(false);
  query = signal<string>('');
  selectedIndex = signal<number>(0);
  allItems = signal<FileItem[]>([]);

  // Commands List
  commands = computed<CommandItem[]>(() => [
    {
      name: 'Go to Note...',
      description: 'Search and navigate to a note in your repository',
      icon: this.faArrowRight,
      action: () => {
        this.query.set('/');
        this.selectedIndex.set(0);
        this.focusInput();
      }
    },
    {
      name: 'Create New Note',
      description: 'Create a new markdown note in the root directory',
      icon: this.faPlus,
      action: () => {
        this.close();
        this.modalService.open({
          title: 'New Note',
          placeholder: 'Enter note title...',
          value: 'Untitled',
          onConfirm: (name) => {
            if (!name.trim()) return;
            const fileName = name.endsWith('.md') ? name : `${name}.md`;
            this.fileService.create(name, 'note', '').subscribe(() => {
              window.dispatchEvent(new CustomEvent('refresh-sidebar'));
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('open-note', { detail: fileName }));
              }, 150);
            });
          }
        });
      }
    },
    {
      name: 'Create New Folder',
      description: 'Create a new folder in the root directory',
      icon: this.faFolder,
      action: () => {
        this.close();
        this.modalService.open({
          title: 'New Folder',
          placeholder: 'Enter folder name...',
          value: 'New Folder',
          onConfirm: (name) => {
            if (!name.trim()) return;
            this.fileService.create(name, 'folder', '').subscribe(() => {
              window.dispatchEvent(new CustomEvent('refresh-sidebar'));
            });
          }
        });
      }
    },
    {
      name: 'Toggle Sidebar',
      description: 'Expand or collapse the sidebar menu',
      icon: this.faBars,
      action: () => {
        this.layout.isSidebarCollapsed.update(v => !v);
        this.close();
      }
    },
    {
      name: 'Open Settings',
      description: 'Open the settings and formatting configurations view',
      icon: this.faGear,
      action: () => {
        this.layout.isSidebarCollapsed.set(false);
        window.dispatchEvent(new CustomEvent('open-settings'));
        this.close();
      }
    },
    {
      name: 'Open Trash Bin',
      description: 'Open the trash view to restore or permanently delete files',
      icon: this.faTrash,
      action: () => {
        this.layout.isSidebarCollapsed.set(false);
        window.dispatchEvent(new CustomEvent('open-trash'));
        this.close();
      }
    },
    {
      name: 'Change Theme: Dark',
      description: 'Set system theme to Default Dark',
      icon: this.faAdjust,
      action: () => {
        this.themeService.setTheme('dark');
        this.close();
      }
    },
    {
      name: 'Change Theme: Light',
      description: 'Set system theme to Default Light',
      icon: this.faAdjust,
      action: () => {
        this.themeService.setTheme('light');
        this.close();
      }
    },
    {
      name: 'Change Theme: Sepia Paper',
      description: 'Set system theme to Sepia Paper',
      icon: this.faAdjust,
      action: () => {
        this.themeService.setTheme('sepia');
        this.close();
      }
    },
    {
      name: 'Change Theme: Sepia Dark',
      description: 'Set system theme to Sepia Dark',
      icon: this.faAdjust,
      action: () => {
        this.themeService.setTheme('sepia-dark');
        this.close();
      }
    },
    {
      name: 'Change Theme: High Contrast Light',
      description: 'Set system theme to High Contrast Light',
      icon: this.faAdjust,
      action: () => {
        this.themeService.setTheme('high-contrast');
        this.close();
      }
    },
    {
      name: 'Change Theme: High Contrast Dark',
      description: 'Set system theme to High Contrast Dark',
      icon: this.faAdjust,
      action: () => {
        this.themeService.setTheme('dark-hc');
        this.close();
      }
    },
    {
      name: 'Change Theme: Gruvbox',
      description: 'Set system theme to Gruvbox layout',
      icon: this.faAdjust,
      action: () => {
        this.themeService.setTheme('gruvbox');
        this.close();
      }
    },
    {
      name: 'Change Theme: Hot Dog Stand',
      description: 'Set system theme to Windows 3.1 Hot Dog Stand nostalgia',
      icon: this.faAdjust,
      action: () => {
        this.themeService.setTheme('hotdog');
        this.close();
      }
    },
    {
      name: 'Restart Server Process',
      description: 'Perform a clean restart of the backend Node.js system',
      icon: this.faPowerOff,
      action: () => {
        this.close();
        if (confirm('Are you sure you want to restart the server? Connection will be lost for a few seconds.')) {
          this.fileService.restartServer().subscribe(() => {
            setTimeout(() => window.location.reload(), 3000);
          });
        }
      }
    },
    {
      name: 'Logout Session',
      description: 'Securely sign out and lock this device',
      icon: this.faPowerOff,
      action: () => {
        this.close();
        if (confirm('Are you sure you want to log out?')) {
          this.authService.logout();
        }
      }
    }
  ]);

  isNavigateMode = computed<boolean>(() => this.query().startsWith('/'));

  // Filter notes recursively based on query
  filteredNotes = computed<FileItem[]>(() => {
    const q = this.query().trim().toLowerCase();
    const searchString = q.startsWith('/') ? q.substring(1) : q;
    const notesOnly = this.allItems().filter(item => item.type === 'note');

    if (!searchString) return notesOnly;

    return notesOnly.filter(note =>
      note.path.toLowerCase().includes(searchString) ||
      note.name.toLowerCase().includes(searchString)
    );
  });

  // Filter general commands
  filteredCommands = computed<CommandItem[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.commands();
    return this.commands().filter(cmd =>
      cmd.name.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q)
    );
  });

  // Combined List for UI mapping
  filteredList = computed<any[]>(() => {
    if (this.isNavigateMode()) {
      return this.filteredNotes().map(note => ({
        name: '/' + note.path.replace(/\.md$/, ''),
        description: `Note: ${note.name.replace(/\.md$/, '')}`,
        icon: this.faFileAlt,
        action: () => {
          this.close();
          if (window.innerWidth <= 768) {
            this.layout.isSidebarCollapsed.set(true);
          }
          window.dispatchEvent(new CustomEvent('open-note', { detail: note.path }));
        }
      }));
    } else {
      return this.filteredCommands();
    }
  });

  constructor() {
    // Keep index in bounds when list changes
    effect(() => {
      const listSize = this.filteredList().length;
      if (this.selectedIndex() >= listSize) {
        this.selectedIndex.set(listSize > 0 ? listSize - 1 : 0);
      }
    });
  }

  @HostListener('window:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent) {
    const isK = event.key.toLowerCase() === 'k';
    const isMetaOrCtrl = event.metaKey || event.ctrlKey;

    if (isMetaOrCtrl && isK) {
      event.preventDefault();
      this.toggle();
    }
  }

  toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen.set(true);
    this.query.set('');
    this.selectedIndex.set(0);
    this.loadAllFiles();
    this.focusInput();
  }

  close() {
    this.isOpen.set(false);
  }

  focusInput() {
    setTimeout(() => {
      if (this.searchInput) {
        this.searchInput.nativeElement.focus();
        this.searchInput.nativeElement.select();
      }
    }, 50);
  }

  async loadAllFiles() {
    try {
      const items = await firstValueFrom(this.fileService.listAll());
      this.allItems.set(items);
    } catch (err) {
      console.error('Failed to recursively load files for command palette:', err);
    }
  }

  onInput() {
    this.selectedIndex.set(0);
  }

  onKeydown(event: KeyboardEvent) {
    const list = this.filteredList();
    if (list.length === 0) {
      if (event.key === 'Escape') {
        this.close();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex.update(idx => (idx + 1) % list.length);
        this.scrollActiveIntoView();
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex.update(idx => (idx - 1 + list.length) % list.length);
        this.scrollActiveIntoView();
        break;

      case 'Tab':
        if (this.isNavigateMode()) {
          event.preventDefault();
          const highlightedNote = this.filteredNotes()[this.selectedIndex()];
          if (highlightedNote) {
            // Replace input query with current note's absolute slash path (without .md)
            this.query.set('/' + highlightedNote.path.replace(/\.md$/, ''));
            this.selectedIndex.set(0);
          }
        }
        break;

      case 'Enter':
        event.preventDefault();
        const activeItem = list[this.selectedIndex()];
        if (activeItem) {
          activeItem.action();
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.close();
        break;
    }
  }

  scrollActiveIntoView() {
    setTimeout(() => {
      const activeEl = document.querySelector('.palette-results .result-item.active');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      }
    }, 0);
  }
}
