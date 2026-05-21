import { Component, signal, inject, OnInit, HostListener } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileService, FileItem } from '../../core/services/file.service';
import { ThemeService, Theme } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { MainLayoutComponent } from '../main-layout/main-layout.component';
import { ModalService } from '../../core/services/modal.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faFolder, 
  faFileAlt, 
  faChevronLeft, 
  faGear, 
  faPlus, 
  faPowerOff, 
  faLock, 
  faTrash, 
  faUndo, 
  faTrashAlt,
  faChevronRight,
  faChevronDown,
  faEllipsisV
} from '@fortawesome/free-solid-svg-icons';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [FormsModule, FontAwesomeModule, NgTemplateOutlet],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  private fileService = inject(FileService);
  public themeService = inject(ThemeService);
  private authService = inject(AuthService);
  private layout = inject(MainLayoutComponent);
  private modalService = inject(ModalService);

  // Icons
  faFolder = faFolder;
  faFileAlt = faFileAlt;
  faChevronLeft = faChevronLeft;
  faGear = faGear;
  faPlus = faPlus;
  faPowerOff = faPowerOff;
  faLock = faLock;
  faTrash = faTrash;
  faUndo = faUndo;
  faTrashAlt = faTrashAlt;
  faChevronRight = faChevronRight;
  faChevronDown = faChevronDown;
  faEllipsisV = faEllipsisV;

  treeItems = signal<FileItem[]>([]);
  expandedFolders = signal<Set<string>>(new Set());
  activeNotePath = signal<string | null>(null);
  
  isSettingsOpen = signal<boolean>(false);
  isTrashOpen = signal<boolean>(false);

  // Password Change State
  oldPassword = signal<string>('');
  newPassword = signal<string>('');
  passwordError = signal<string | null>(null);
  passwordSuccess = signal<boolean>(false);

  trashItems = signal<FileItem[]>([]);
  contextMenu = signal<{ x: number, y: number, item: FileItem | null } | null>(null);

  ngOnInit() {
    this.refreshTree();
    this.themeService.loadSettings();
  }

  @HostListener('window:refresh-sidebar')
  onRefreshSidebar() {
    if (this.isTrashOpen()) {
      this.loadTrash();
    } else {
      this.refreshTree();
    }
  }

  @HostListener('window:open-note', ['$event'])
  onNoteOpened(event: any) {
    this.activeNotePath.set(event.detail);
  }

  @HostListener('window:open-settings')
  onOpenSettings() {
    this.isSettingsOpen.set(true);
    this.isTrashOpen.set(false);
  }

  @HostListener('window:open-trash')
  onOpenTrash() {
    this.isTrashOpen.set(true);
    this.isSettingsOpen.set(false);
    this.loadTrash();
  }

  async refreshTree() {
    if (this.isTrashOpen()) {
      this.loadTrash();
      return;
    }
    try {
      const items = await firstValueFrom(this.fileService.list(''));
      await this.loadExpandedChildren(items);
      this.treeItems.set(items);
    } catch (err) {
      console.error('Failed to list files:', err);
    }
  }

  async loadExpandedChildren(items: FileItem[]) {
    const promises = items.map(async (item) => {
      if (item.type === 'folder' && this.expandedFolders().has(item.path)) {
        try {
          const children = await firstValueFrom(this.fileService.list(item.path));
          item.children = children;
          await this.loadExpandedChildren(children);
        } catch (err) {
          console.error(`Failed to list children of ${item.path}:`, err);
        }
      }
    });
    await Promise.all(promises);
  }

  onItemClick(item: FileItem) {
    this.closeContextMenu();
    if (item.type === 'folder') {
      this.toggleFolder(item);
    } else {
      this.activeNotePath.set(item.path);
      if (window.innerWidth <= 768) {
        this.layout.isSidebarCollapsed.set(true);
      }
      window.dispatchEvent(new CustomEvent('open-note', { detail: item.path }));
    }
  }

  toggleFolder(item: FileItem) {
    this.expandedFolders.update(set => {
      const newSet = new Set(set);
      if (newSet.has(item.path)) {
        newSet.delete(item.path);
      } else {
        newSet.add(item.path);
      }
      return newSet;
    });
    this.refreshTree();
  }

  isExpanded(path: string): boolean {
    return this.expandedFolders().has(path);
  }

  loadTrash() {
    this.fileService.listTrash().subscribe(items => {
      this.trashItems.set(items);
    });
  }

  goBack() {
    if (this.isSettingsOpen()) {
      this.isSettingsOpen.set(false);
    } else if (this.isTrashOpen()) {
      this.isTrashOpen.set(false);
    }
    this.refreshTree();
  }

  toggleSettings() {
    this.isSettingsOpen.update(v => !v);
    this.isTrashOpen.set(false);
  }

  toggleTrash() {
    this.isTrashOpen.update(v => !v);
    this.isSettingsOpen.set(false);
    if (this.isTrashOpen()) {
      this.loadTrash();
    } else {
      this.refreshTree();
    }
  }

  restoreItem(item: FileItem) {
    this.fileService.restore(item.path).subscribe(() => {
      this.loadTrash();
      this.refreshTree();
    });
  }

  deleteItemPermanently(item: FileItem) {
    if (confirm(`Are you sure you want to permanently delete "${item.name}"? This cannot be undone.`)) {
      this.fileService.delete(item.path).subscribe(() => {
        this.loadTrash();
      });
    }
  }

  createNote(parentPath: string = '') {
    this.modalService.open({
      title: 'New Note',
      placeholder: 'Enter note title...',
      value: 'Untitled',
      onConfirm: (name) => {
        if (!name.trim()) return;
        const fileName = name.endsWith('.md') ? name : `${name}.md`;
        const fullPath = parentPath ? `${parentPath}/${fileName}` : fileName;

        this.fileService.create(name, 'note', parentPath).subscribe(() => {
          if (parentPath) {
            this.expandedFolders.update(set => {
              const newSet = new Set(set);
              newSet.add(parentPath);
              return newSet;
            });
          }
          this.refreshTree().then(() => {
            this.activeNotePath.set(fullPath);
            if (window.innerWidth <= 768) this.layout.isSidebarCollapsed.set(true);
            window.dispatchEvent(new CustomEvent('open-note', { detail: fullPath }));
          });
        });
      }
    });
  }

  createFolder(parentPath: string = '') {
    this.modalService.open({
      title: 'New Folder',
      placeholder: 'Enter folder name...',
      value: 'New Folder',
      onConfirm: (name) => {
        if (!name.trim()) return;
        this.fileService.create(name, 'folder', parentPath).subscribe(() => {
          if (parentPath) {
            this.expandedFolders.update(set => {
              const newSet = new Set(set);
              newSet.add(parentPath);
              return newSet;
            });
          }
          this.refreshTree();
        });
      }
    });
  }

  renameItem(item: FileItem) {
    const isNote = item.type === 'note';
    const currentDisplayName = isNote ? item.name.replace(/\.md$/, '') : item.name;
    this.modalService.open({
      title: `Rename ${isNote ? 'Note' : 'Folder'}`,
      placeholder: 'Enter new name...',
      value: currentDisplayName,
      onConfirm: (newName) => {
        if (!newName.trim() || newName === currentDisplayName) return;
        const finalName = isNote ? (newName.endsWith('.md') ? newName : `${newName}.md`) : newName;
        this.fileService.rename(item.path, finalName).subscribe(() => {
          this.refreshTree();
          if (this.activeNotePath() === item.path) {
            const parentPath = item.path.split('/').slice(0, -1).join('/');
            const newPath = parentPath ? `${parentPath}/${finalName}` : finalName;
            this.activeNotePath.set(newPath);
            window.dispatchEvent(new CustomEvent('open-note', { detail: newPath }));
          }
        });
      }
    });
  }

  deleteItem(item: FileItem) {
    const isTrash = item.path.startsWith('.trash');
    const msg = isTrash 
      ? `Are you sure you want to permanently delete "${item.name}"? This cannot be undone.`
      : `Are you sure you want to move "${item.name}" to Trash?`;
    if (confirm(msg)) {
      this.fileService.delete(item.path).subscribe(() => {
        if (isTrash) {
          this.loadTrash();
        } else {
          this.refreshTree();
          const activePath = this.activeNotePath();
          if (activePath && (activePath === item.path || activePath.startsWith(item.path + '/'))) {
            this.activeNotePath.set(null);
            window.dispatchEvent(new CustomEvent('open-note', { detail: '' }));
          }
        }
      });
    }
  }

  onMoreActionsClick(event: MouseEvent, item: FileItem) {
    event.preventDefault();
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    
    // Position menu to align nicely under the 3-dots button
    let x = rect.left;
    let y = rect.bottom + 4;
    const menuWidth = 170;
    const menuHeight = 160;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = rect.top - menuHeight - 4;
    }

    this.contextMenu.set({ x, y, item });
  }

  onContextMenu(event: MouseEvent, item: FileItem | null) {
    event.preventDefault();
    event.stopPropagation();

    let x = event.clientX;
    let y = event.clientY;
    const menuWidth = 170;
    const menuHeight = 160;

    if (x + menuWidth > window.innerWidth) {
      x -= menuWidth;
    }
    if (y + menuHeight > window.innerHeight) {
      y -= menuHeight;
    }

    this.contextMenu.set({ x, y, item });
  }

  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  closeContextMenu() {
    this.contextMenu.set(null);
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

  onChangePassword() {
    this.passwordError.set(null);
    this.passwordSuccess.set(false);

    if (!this.oldPassword() || !this.newPassword()) {
      this.passwordError.set('All fields are required');
      return;
    }

    this.authService.changePassword(this.oldPassword(), this.newPassword()).subscribe({
      next: () => {
        this.passwordSuccess.set(true);
        this.oldPassword.set('');
        this.newPassword.set('');
        setTimeout(() => this.passwordSuccess.set(false), 3000);
      },
      error: (err) => {
        this.passwordError.set(err.error?.error || 'Failed to change password');
      }
    });
  }

  logout() {
    if (confirm('Are you sure you want to log out?')) {
      this.authService.logout();
    }
  }
}
