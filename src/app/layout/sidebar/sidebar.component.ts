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

  // Drag & Drop State Signals
  draggedItem = signal<FileItem | null>(null);
  dragOverItem = signal<FileItem | null>(null);
  isDragOverTreeContainer = signal<boolean>(false);
  touchDragProxy = signal<{ name: string, type: 'note' | 'folder', x: number, y: number } | null>(null);

  // Touch/Long press internal mechanics
  private touchTimer: any = null;
  private touchStartPos = { x: 0, y: 0 };
  private isTouchDragging = false;

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

  // --- Drag & Drop Methods ---

  // Desktop drag starts
  onDragStart(event: DragEvent, item: FileItem) {
    if (this.isTrashOpen() || this.isSettingsOpen()) return;
    this.closeContextMenu();
    this.draggedItem.set(item);
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', item.path);
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOver(event: DragEvent, item: FileItem) {
    if (item.type === 'folder' && this.isValidDropTarget(item)) {
      event.preventDefault();
      this.dragOverItem.set(item);
      this.isDragOverTreeContainer.set(false);
    }
  }

  onDragLeave(event: DragEvent, item: FileItem) {
    if (this.dragOverItem() === item) {
      this.dragOverItem.set(null);
    }
  }

  onDragEnd(event: DragEvent) {
    this.draggedItem.set(null);
    this.dragOverItem.set(null);
    this.isDragOverTreeContainer.set(false);
  }

  onTreeContainerDragOver(event: DragEvent) {
    if (this.draggedItem() && this.isValidDropTarget('root')) {
      event.preventDefault();
      this.isDragOverTreeContainer.set(true);
    }
  }

  onTreeContainerDragLeave(event: DragEvent) {
    this.isDragOverTreeContainer.set(false);
  }

  onDrop(event: DragEvent, target: FileItem | 'root') {
    event.preventDefault();
    event.stopPropagation();
    
    const dragged = this.draggedItem();
    if (!dragged) return;

    if (!this.isValidDropTarget(target)) return;

    const targetParentPath = target === 'root' ? '' : target.path;
    this.executeMove(dragged, targetParentPath);
  }

  // --- Mobile Touch Drag & Drop Methods ---

  onTouchStart(event: TouchEvent, item: FileItem) {
    if (this.isTrashOpen() || this.isSettingsOpen()) return;
    
    const touch = event.touches[0];
    this.touchStartPos = { x: touch.clientX, y: touch.clientY };
    this.isTouchDragging = false;

    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
    }

    this.touchTimer = setTimeout(() => {
      // Enter Touch Drag Mode after 400ms long press
      this.isTouchDragging = true;
      this.draggedItem.set(item);

      // Web Haptic Feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }

      this.touchDragProxy.set({
        name: item.name,
        type: item.type,
        x: touch.clientX,
        y: touch.clientY
      });
    }, 400);
  }

  onTouchMove(event: TouchEvent) {
    const touch = event.touches[0];
    const dx = touch.clientX - this.touchStartPos.x;
    const dy = touch.clientY - this.touchStartPos.y;

    if (!this.isTouchDragging) {
      // Cancel the long-press timer if finger moves before drag activation
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        if (this.touchTimer) {
          clearTimeout(this.touchTimer);
          this.touchTimer = null;
        }
      }
      return;
    }

    // Active drag: prevent default scroll behavior and update proxy position
    event.preventDefault();
    const proxy = this.touchDragProxy();
    if (proxy) {
      this.touchDragProxy.set({
        ...proxy,
        x: touch.clientX,
        y: touch.clientY
      });
    }

    // Resolve target element underneath finger
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!element) return;

    const itemEl = element.closest('.sidebar-item');
    if (itemEl) {
      const path = itemEl.getAttribute('data-path');
      if (path) {
        const targetItem = this.findItemByPath(this.treeItems(), path);
        if (targetItem && targetItem.type === 'folder' && this.isValidDropTarget(targetItem)) {
          this.dragOverItem.set(targetItem);
          this.isDragOverTreeContainer.set(false);
          return;
        }
      }
    }

    const treeContainerEl = element.closest('.tree-container');
    if (treeContainerEl) {
      if (this.isValidDropTarget('root')) {
        this.isDragOverTreeContainer.set(true);
      }
      this.dragOverItem.set(null);
    } else {
      this.isDragOverTreeContainer.set(false);
      this.dragOverItem.set(null);
    }
  }

  onTouchEnd(event: TouchEvent) {
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }

    if (this.isTouchDragging) {
      event.preventDefault();
      
      const dragged = this.draggedItem();
      const targetFolder = this.dragOverItem();
      const isRoot = this.isDragOverTreeContainer();

      if (dragged) {
        if (targetFolder && this.isValidDropTarget(targetFolder)) {
          this.executeMove(dragged, targetFolder.path);
        } else if (isRoot && this.isValidDropTarget('root')) {
          this.executeMove(dragged, '');
        }
      }

      // Reset
      this.isTouchDragging = false;
      this.draggedItem.set(null);
      this.dragOverItem.set(null);
      this.isDragOverTreeContainer.set(false);
      this.touchDragProxy.set(null);
    }
  }

  onTouchCancel(event: TouchEvent) {
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }
    this.isTouchDragging = false;
    this.draggedItem.set(null);
    this.dragOverItem.set(null);
    this.isDragOverTreeContainer.set(false);
    this.touchDragProxy.set(null);
  }

  // --- Helper Validation and Move Methods ---

  isValidDropTarget(target: FileItem | 'root'): boolean {
    const dragged = this.draggedItem();
    if (!dragged) return false;

    if (target === 'root') {
      return dragged.path.includes('/');
    }

    // Can't drop into itself
    if (dragged.path === target.path) return false;

    // Can't drop a folder into its own subfolder
    if (target.path.startsWith(dragged.path + '/')) return false;

    // Can't drop into its current parent folder
    const currentParent = dragged.path.split('/').slice(0, -1).join('/');
    if (currentParent === target.path) return false;

    return true;
  }

  findItemByPath(items: FileItem[], path: string): FileItem | null {
    for (const item of items) {
      if (item.path === path) return item;
      if (item.children) {
        const found = this.findItemByPath(item.children, path);
        if (found) return found;
      }
    }
    return null;
  }

  private executeMove(sourceItem: FileItem, targetParentPath: string) {
    this.fileService.move(sourceItem.path, targetParentPath).subscribe({
      next: () => {
        // Recalculate editor paths if needed
        this.updateActiveNotePathAfterMove(sourceItem.path, targetParentPath, sourceItem.type);

        // Auto-expand drop folder
        if (targetParentPath) {
          this.expandedFolders.update(set => {
            const newSet = new Set(set);
            newSet.add(targetParentPath);
            return newSet;
          });
        }

        this.refreshTree();
      },
      error: (err) => {
        console.error('Failed to move item:', err);
      }
    });
  }

  private updateActiveNotePathAfterMove(oldPath: string, targetParentPath: string, type: 'folder' | 'note') {
    const activePath = this.activeNotePath();
    if (!activePath) return;

    const name = oldPath.split('/').pop()!;
    const newPath = targetParentPath ? `${targetParentPath}/${name}` : name;

    if (type === 'note' && activePath === oldPath) {
      this.activeNotePath.set(newPath);
      window.dispatchEvent(new CustomEvent('open-note', { detail: newPath }));
    } else if (type === 'folder') {
      if (activePath === oldPath || activePath.startsWith(oldPath + '/')) {
        const suffix = activePath.substring(oldPath.length);
        const updatedActivePath = newPath + suffix;
        this.activeNotePath.set(updatedActivePath);
        window.dispatchEvent(new CustomEvent('open-note', { detail: updatedActivePath }));
      }
    }
  }
}
