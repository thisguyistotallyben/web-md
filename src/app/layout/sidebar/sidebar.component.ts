import { Component, signal, computed, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileService, FileItem } from '../../core/services/file.service';
import { ThemeService, Theme } from '../../core/services/theme.service';
import { MainLayoutComponent } from '../main-layout/main-layout.component';
import { ModalService } from '../../core/services/modal.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faFolder, faFileAlt, faChevronLeft, faGear, faPlus, faPowerOff } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  private fileService = inject(FileService);
  public themeService = inject(ThemeService);
  private layout = inject(MainLayoutComponent);
  private modalService = inject(ModalService);

  // Icons
  faFolder = faFolder;
  faFileAlt = faFileAlt;
  faChevronLeft = faChevronLeft;
  faGear = faGear;
  faPlus = faPlus;
  faPowerOff = faPowerOff;

  notebooks = signal<FileItem[]>([]);
  currentNotebook = signal<FileItem | null>(null);
  currentSubFolder = signal<FileItem | null>(null);
  activeNotePath = signal<string | null>(null);
  
  isRenaming = signal<boolean>(false);
  isSettingsOpen = signal<boolean>(false);

  currentItems = signal<FileItem[]>([]);

  ngOnInit() {
    this.loadRoot();
    this.themeService.loadSettings();
  }

  @HostListener('window:refresh-sidebar')
  onRefreshSidebar() {
    const notebook = this.currentNotebook();
    const subFolder = this.currentSubFolder();
    if (subFolder) {
      this.fileService.list(subFolder.path).subscribe(items => this.currentItems.set(items));
    } else if (notebook) {
      this.fileService.list(notebook.path).subscribe(items => this.currentItems.set(items));
    } else {
      this.loadRoot();
    }
  }

  @HostListener('window:open-note', ['$event'])
  onNoteOpened(event: any) {
    this.activeNotePath.set(event.detail);
  }

  loadRoot() {
    this.fileService.list('').subscribe(items => {
      this.notebooks.set(items);
      this.currentItems.set(items);
    });
  }

  selectItem(item: FileItem) {
    if (item.type === 'folder') {
      if (!this.currentNotebook()) {
        this.currentNotebook.set(item);
        this.fileService.list(item.path).subscribe(items => this.currentItems.set(items));
      } else {
        this.currentSubFolder.set(item);
        this.fileService.list(item.path).subscribe(items => this.currentItems.set(items));
      }
      this.isRenaming.set(false);
      this.isSettingsOpen.set(false);
    } else {
      this.activeNotePath.set(item.path);
      if (window.innerWidth <= 768) {
        this.layout.isSidebarCollapsed.set(true);
      }
      window.dispatchEvent(new CustomEvent('open-note', { detail: item.path }));
    }
  }

  goBack() {
    if (this.isSettingsOpen()) {
      this.isSettingsOpen.set(false);
    } else if (this.currentSubFolder()) {
      this.currentSubFolder.set(null);
      this.fileService.list(this.currentNotebook()?.path || '').subscribe(items => this.currentItems.set(items));
      this.isRenaming.set(false);
    } else if (this.currentNotebook()) {
      this.currentNotebook.set(null);
      this.loadRoot();
      this.isRenaming.set(false);
    }
  }

  toggleSettings() {
    this.isSettingsOpen.update(v => !v);
  }

  startRename() {
    this.isRenaming.set(true);
  }

  finishRename(newName: string) {
    const active = this.currentSubFolder() || this.currentNotebook();
    if (active && newName.trim() && newName !== active.name) {
      this.fileService.rename(active.path, newName).subscribe(() => {
        if (this.currentSubFolder()) {
          this.currentSubFolder.set({ ...active, name: newName });
        } else {
          this.currentNotebook.set({ ...active, name: newName });
        }
        this.isRenaming.set(false);
      });
    } else {
      this.isRenaming.set(false);
    }
  }

  handleRenameKeydown(event: KeyboardEvent, input: HTMLInputElement) {
    if (event.key === 'Enter') this.finishRename(input.value);
    else if (event.key === 'Escape') this.isRenaming.set(false);
  }

  createNewNotebook() {
    this.modalService.open({
      title: 'New Notebook',
      placeholder: 'Enter notebook name...',
      value: 'New Notebook',
      onConfirm: (name) => {
        this.fileService.create(name, 'folder', '').subscribe(() => this.loadRoot());
      }
    });
  }

  createNewFolder() {
    const notebook = this.currentNotebook();
    if (!notebook) return;
    this.modalService.open({
      title: 'New Folder',
      placeholder: 'Enter folder name...',
      value: 'New Folder',
      onConfirm: (name) => {
        this.fileService.create(name, 'folder', notebook.path).subscribe(() => {
          this.fileService.list(notebook.path).subscribe(items => this.currentItems.set(items));
        });
      }
    });
  }

  createNewNote() {
    const active = this.currentSubFolder() || this.currentNotebook();
    const parentPath = active ? active.path : '';
    this.modalService.open({
      title: 'New Note',
      placeholder: 'Enter note title...',
      value: 'Untitled',
      onConfirm: (name) => {
        const fileName = name.endsWith('.md') ? name : `${name}.md`;
        const fullPath = parentPath ? `${parentPath}/${fileName}` : fileName;

        this.fileService.create(name, 'note', parentPath).subscribe(() => {
          this.fileService.list(parentPath).subscribe(items => {
            this.currentItems.set(items);
            this.activeNotePath.set(fullPath);
            if (window.innerWidth <= 768) this.layout.isSidebarCollapsed.set(true);
            window.dispatchEvent(new CustomEvent('open-note', { detail: fullPath }));
          });
        });
      }
    });
  }

  setTheme(theme: Theme) {
    this.themeService.setTheme(theme);
  }

  restartServer() {
    if (confirm('Are you sure you want to restart the server? Connection will be lost for a few seconds.')) {
      this.fileService.restartServer().subscribe(() => {
        setTimeout(() => window.location.reload(), 3000);
      });
    }
  }
}
