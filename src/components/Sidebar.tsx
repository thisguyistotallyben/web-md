'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FileText,
  Trash2,
  Settings,
  Plus,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  LogOut,
  Lock,
  RefreshCw,
  Search,
  Check,
  FolderPlus,
  Edit2
} from 'lucide-react';
import PromptModal from './PromptModal';
import styles from './Sidebar.module.css';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  activeNotePath: string | null;
  treeItems: any[];
  onSelectNote: (path: string) => void;
  onRefreshTree: () => void;
  onLogoutSuccess: () => void;
  onRenameItem: (oldPath: string, newName: string) => Promise<void>;
  onDeleteItem: (path: string) => Promise<void>;
}

export default function Sidebar({
  isCollapsed,
  onToggle,
  activeNotePath,
  treeItems,
  onSelectNote,
  onRefreshTree,
  onLogoutSuccess,
  onRenameItem,
  onDeleteItem,
}: SidebarProps) {
  const [search, setSearch] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  
  // Settings password states
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('dark');

  // Trash files state
  const [trashItems, setTrashItems] = useState<any[]>([]);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: any | null } | null>(null);

  // Reusable Prompt Modal state
  const [promptModal, setPromptModal] = useState<{
    isOpen: boolean;
    title: string;
    placeholder: string;
    defaultValue: string;
    onConfirm: (val: string) => void | Promise<void>;
  } | null>(null);

  // Drag and Drop States
  const [draggedItem, setDraggedItem] = useState<any | null>(null);
  const [dragOverItem, setDragOverItem] = useState<any | null>(null);
  const [isDragOverTreeContainer, setIsDragOverTreeContainer] = useState(false);
  const [touchDragProxy, setTouchDragProxy] = useState<{ name: string; type: 'note' | 'folder'; x: number; y: number } | null>(null);

  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const isTouchDraggingRef = useRef(false);

  // Load theme and settings
  useEffect(() => {
    loadSettings();
    // Dismiss menus on document click or escape key
    const handleDismiss = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.closest(`.${styles.moreActionsBtn}`)) {
        return; // Do not dismiss if clicking the actions button itself!
      }
      setContextMenu(null);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('click', handleDismiss);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleDismiss);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Automatically restore children for all folders in expandedFolders when treeItems changes
  useEffect(() => {
    let active = true;

    const loadExpandedChildren = async () => {
      if (expandedFolders.size === 0) return;

      let changed = false;
      const queue = [...treeItems];

      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) continue;

        if (item.type === 'folder') {
          if (expandedFolders.has(item.path)) {
            if (!item.children) {
              try {
                const res = await fetch(`/api/fs?path=${encodeURIComponent(item.path)}`);
                if (res.ok && active) {
                  item.children = await res.json();
                  changed = true;
                }
              } catch (err) {
                console.error('[Sidebar] Failed to reload children for expanded folder:', item.path, err);
              }
            }
            if (item.children) {
              queue.push(...item.children);
            }
          }
        }
      }

      if (changed && active) {
        // Trigger a force re-render by doing a shallow copy of expandedFolders
        setExpandedFolders(new Set(expandedFolders));
      }
    };

    loadExpandedChildren();

    return () => {
      active = false;
    };
  }, [treeItems]);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.theme) {
          applyTheme(data.theme, false);
        }
      }
    } catch (err) {
      console.error('[Sidebar] Failed to load settings:', err);
    }
  };

  const applyTheme = async (themeName: string, save = true) => {
    // Remove all legacy classes
    document.documentElement.className = '';
    document.documentElement.classList.add(`theme-${themeName}`);
    setCurrentTheme(themeName);
    localStorage.setItem('app_theme', themeName);

    if (save) {
      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: themeName }),
        });
      } catch (err) {
        console.error('[Sidebar] Failed to save theme:', err);
      }
    }
  };

  const loadTrash = async () => {
    try {
      const res = await fetch('/api/fs/trash');
      if (res.ok) {
        const data = await res.json();
        setTrashItems(data);
      }
    } catch (err) {
      console.error('[Sidebar] Failed to load trash items:', err);
    }
  };

  const handleToggleFolder = async (folder: any) => {
    setContextMenu(null);
    const newSet = new Set(expandedFolders);
    if (newSet.has(folder.path)) {
      newSet.delete(folder.path);
    } else {
      newSet.add(folder.path);
      // Fetch children dynamically and attach them
      try {
        const res = await fetch(`/api/fs?path=${encodeURIComponent(folder.path)}`);
        if (res.ok) {
          const children = await res.json();
          folder.children = children;
        }
      } catch (err) {
        console.error('[Sidebar] Dynamic children retrieval error:', err);
      }
    }
    setExpandedFolders(newSet);
  };

  const handleItemClick = (item: any) => {
    setContextMenu(null);
    if (item.type === 'folder') {
      handleToggleFolder(item);
    } else {
      onSelectNote(item.path);
    }
  };

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
    setIsTrashOpen(false);
  };

  const handleOpenTrash = () => {
    setIsTrashOpen(true);
    setIsSettingsOpen(false);
    loadTrash();
  };

  const handleGoBack = () => {
    setIsSettingsOpen(false);
    setIsTrashOpen(false);
    onRefreshTree();
  };

  const handleRestoreItem = async (item: any) => {
    try {
      const res = await fetch('/api/fs/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: item.path }),
      });
      if (res.ok) {
        loadTrash();
        onRefreshTree();
      }
    } catch (err) {
      console.error('[Sidebar] Restore error:', err);
    }
  };

  const handlePermanentDelete = async (item: any) => {
    if (confirm(`Are you sure you want to permanently delete "${item.name}"? This cannot be undone.`)) {
      await onDeleteItem(item.path);
      loadTrash();
    }
  };

  const handleCreateItem = (type: 'folder' | 'note', parentPath = '') => {
    setPromptModal({
      isOpen: true,
      title: `New ${type === 'folder' ? 'Folder' : 'Note'}`,
      placeholder: `Enter ${type} name...`,
      defaultValue: type === 'folder' ? 'New Folder' : 'Untitled',
      onConfirm: async (name) => {
        if (!name.trim()) return;
        const res = await fetch('/api/fs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, type, parentPath }),
        });
        if (res.ok) {
          if (parentPath) {
            setExpandedFolders((prev) => {
              const next = new Set(prev);
              next.add(parentPath);
              return next;
            });
          }
          onRefreshTree();
        }
      },
    });
  };

  const handleRenameClick = (item: any) => {
    const isNote = item.type === 'note';
    const currentDisplayName = isNote ? item.name.replace(/\.md$/, '') : item.name;

    setPromptModal({
      isOpen: true,
      title: `Rename ${isNote ? 'Note' : 'Folder'}`,
      placeholder: 'Enter new name...',
      defaultValue: currentDisplayName,
      onConfirm: async (newName) => {
        if (!newName.trim() || newName === currentDisplayName) return;
        const finalName = isNote ? (newName.endsWith('.md') ? newName : `${newName}.md`) : newName;
        
        if (item.type === 'folder') {
          const parentPath = item.path.split('/').slice(0, -1).join('/');
          const newPath = parentPath ? `${parentPath}/${finalName}` : finalName;
          setExpandedFolders((prev) => {
            const next = new Set<string>();
            for (const path of prev) {
              if (path === item.path) {
                next.add(newPath);
              } else if (path.startsWith(item.path + '/')) {
                next.add(path.replace(item.path, newPath));
              } else {
                next.add(path);
              }
            }
            return next;
          });
        }

        await onRenameItem(item.path, finalName);
      },
    });
  };

  const handleDeleteClick = async (item: any) => {
    const msg = `Are you sure you want to delete "${item.name.replace('.md', '')}"?`;
    if (confirm(msg)) {
      await onDeleteItem(item.path);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!oldPassword || !newPassword) {
      setPasswordError('All fields are required');
      return;
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPasswordSuccess(true);
        setOldPassword('');
        setNewPassword('');
        setTimeout(() => setPasswordSuccess(false), 3000);
      } else {
        setPasswordError(data.error || 'Failed to update password');
      }
    } catch {
      setPasswordError('Network error updating password');
    }
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      try {
        const res = await fetch('/api/auth/logout', { method: 'POST' });
        if (res.ok) {
          onLogoutSuccess();
        }
      } catch (err) {
        console.error('[Sidebar] Logout failure:', err);
      }
    }
  };

  const handleRestartServer = async () => {
    if (confirm('Are you sure you want to restart the server? Connection will be lost for a few seconds.')) {
      try {
        await fetch('/api/system/restart', { method: 'POST' });
        setTimeout(() => window.location.reload(), 3000);
      } catch {
        console.error('[Sidebar] Server restart error');
      }
    }
  };

  // --- Drag and Drop Handlers ---
  const isValidDropTarget = (target: any | 'root') => {
    if (!draggedItem) return false;
    if (target === 'root') {
      return draggedItem.path.includes('/');
    }
    if (draggedItem.path === target.path) return false;
    if (target.path.startsWith(draggedItem.path + '/')) return false;
    const currentParent = draggedItem.path.split('/').slice(0, -1).join('/');
    if (currentParent === target.path) return false;
    return true;
  };

  const executeMove = async (sourcePath: string, targetParentPath: string) => {
    try {
      const res = await fetch('/api/fs/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath, targetParentPath }),
      });
      if (res.ok) {
        setExpandedFolders((prev) => {
          const next = new Set(prev);
          if (targetParentPath) {
            next.add(targetParentPath);
          }
          // If we moved a folder, we need to update its path and any nested expanded paths inside it!
          if (draggedItem && draggedItem.type === 'folder' && draggedItem.path === sourcePath) {
            const folderName = sourcePath.split('/').pop() || '';
            const newPath = targetParentPath ? `${targetParentPath}/${folderName}` : folderName;
            for (const path of prev) {
              if (path === sourcePath) {
                next.delete(path);
                next.add(newPath);
              } else if (path.startsWith(sourcePath + '/')) {
                next.delete(path);
                next.add(path.replace(sourcePath, newPath));
              }
            }
          }
          return next;
        });
        onRefreshTree();
      }
    } catch (err) {
      console.error('[Sidebar] Move failed:', err);
    }
  };

  const onDragStart = (e: React.DragEvent, item: any) => {
    if (isTrashOpen || isSettingsOpen) return;
    setContextMenu(null);
    setDraggedItem(item);
    e.dataTransfer.setData('text/plain', item.path);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent, item: any) => {
    if (item.type === 'folder' && isValidDropTarget(item)) {
      e.preventDefault();
      setDragOverItem(item);
      setIsDragOverTreeContainer(false);
    }
  };

  const onDragLeave = (item: any) => {
    if (dragOverItem === item) setDragOverItem(null);
  };

  const onDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
    setIsDragOverTreeContainer(false);
  };

  const onTreeContainerDragOver = (e: React.DragEvent) => {
    if (draggedItem && isValidDropTarget('root')) {
      e.preventDefault();
      setIsDragOverTreeContainer(true);
    }
  };

  const onTreeContainerDragLeave = () => {
    setIsDragOverTreeContainer(false);
  };

  const onDrop = (e: React.DragEvent, target: any | 'root') => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;
    if (!isValidDropTarget(target)) return;

    const targetParentPath = target === 'root' ? '' : target.path;
    executeMove(draggedItem.path, targetParentPath);
    setDraggedItem(null);
    setDragOverItem(null);
    setIsDragOverTreeContainer(false);
  };

  // --- Mobile Touch Drag & Drop ---
  const onTouchStart = (e: React.TouchEvent, item: any) => {
    if (isTrashOpen || isSettingsOpen) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isTouchDraggingRef.current = false;

    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);

    touchTimerRef.current = setTimeout(() => {
      isTouchDraggingRef.current = true;
      setDraggedItem(item);

      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }

      setTouchDragProxy({
        name: item.name,
        type: item.type,
        x: touch.clientX,
        y: touch.clientY,
      });
    }, 400);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPosRef.current.x;
    const dy = touch.clientY - touchStartPosRef.current.y;

    if (!isTouchDraggingRef.current) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        if (touchTimerRef.current) {
          clearTimeout(touchTimerRef.current);
          touchTimerRef.current = null;
        }
      }
      return;
    }

    e.preventDefault();
    if (touchDragProxy) {
      setTouchDragProxy((prev) => (prev ? { ...prev, x: touch.clientX, y: touch.clientY } : null));
    }

    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!element) return;

    const itemEl = element.closest('.sidebarItemTouchTarget');
    if (itemEl) {
      const path = itemEl.getAttribute('data-path');
      if (path) {
        // Find inside treeItems
        const found = findItemByPath(treeItems, path);
        if (found && found.type === 'folder' && isValidDropTarget(found)) {
          setDragOverItem(found);
          setIsDragOverTreeContainer(false);
          return;
        }
      }
    }

    const containerEl = element.closest('.treeContainerTouchTarget');
    if (containerEl) {
      if (isValidDropTarget('root')) {
        setIsDragOverTreeContainer(true);
      }
      setDragOverItem(null);
    } else {
      setIsDragOverTreeContainer(false);
      setDragOverItem(null);
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }

    if (isTouchDraggingRef.current) {
      e.preventDefault();
      if (draggedItem) {
        if (dragOverItem && isValidDropTarget(dragOverItem)) {
          executeMove(draggedItem.path, dragOverItem.path);
        } else if (isDragOverTreeContainer && isValidDropTarget('root')) {
          executeMove(draggedItem.path, '');
        }
      }
      isTouchDraggingRef.current = false;
      setDraggedItem(null);
      setDragOverItem(null);
      setIsDragOverTreeContainer(false);
      setTouchDragProxy(null);
    }
  };

  const findItemByPath = (items: any[], path: string): any | null => {
    for (const item of items) {
      if (item.path === path) return item;
      if (item.children) {
        const found = findItemByPath(item.children, path);
        if (found) return found;
      }
    }
    return null;
  };

  // Right-Click Context Menu Trigger
  const handleContextMenu = (e: React.MouseEvent, item: any | null) => {
    e.preventDefault();
    e.stopPropagation();

    let x = e.clientX;
    let y = e.clientY;
    const menuWidth = 170;
    const menuHeight = 160;

    if (x + menuWidth > window.innerWidth) {
      x -= menuWidth;
    }
    if (y + menuHeight > window.innerHeight) {
      y -= menuHeight;
    }

    setContextMenu({ x, y, item });
  };

  // Filter tree items by search query
  const filterTreeItems = (items: any[]): any[] => {
    return items
      .map((item) => {
        if (item.type === 'folder') {
          const matchingChildren = item.children ? filterTreeItems(item.children) : [];
          const matchesFolder = item.name.toLowerCase().includes(search.toLowerCase());
          if (matchesFolder || matchingChildren.length > 0) {
            return { ...item, children: matchingChildren };
          }
          return null;
        } else {
          const matchesNote = item.name.toLowerCase().includes(search.toLowerCase());
          return matchesNote ? item : null;
        }
      })
      .filter(Boolean);
  };

  const displayedTreeItems = search ? filterTreeItems(treeItems) : treeItems;

  // Render tree node recursive component
  const renderTreeNode = (items: any[], depth = 0) => {
    return items.map((item) => {
      const isFolder = item.type === 'folder';
      const isExpanded = expandedFolders.has(item.path);
      const isActive = activeNotePath === item.path;

      return (
        <div key={item.path} className={styles.treeItemWrapper}>
          <div
            className={`${styles.sidebarItem} ${isFolder ? styles.folderItem : styles.noteItem} ${
              isActive ? styles.active : ''
            } ${draggedItem?.path === item.path ? styles.isDragging : ''} ${
              dragOverItem?.path === item.path ? styles.dragOver : ''
            } sidebarItemTouchTarget`}
            style={{ paddingLeft: `${depth * 14 + 12}px` }}
            data-path={item.path}
            data-type={item.type}
            draggable={!isTrashOpen && !isSettingsOpen}
            onClick={() => handleItemClick(item)}
            onContextMenu={(e) => handleContextMenu(e, item)}
            onDragStart={(e) => onDragStart(e, item)}
            onDragOver={(e) => onDragOver(e, item)}
            onDragLeave={() => onDragLeave(item)}
            onDrop={(e) => onDrop(e, item)}
            onTouchStart={(e) => onTouchStart(e, item)}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
          >
            {isFolder ? (
              <span
                className={styles.expandIcon}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFolder(item);
                }}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            ) : (
              <span className={styles.spacerIcon} />
            )}

            <span className={styles.icon}>
              {isFolder ? (
                <Folder size={16} className={styles.folderIconSvg} />
              ) : (
                <FileText size={16} className={styles.noteIconSvg} />
              )}
            </span>

            <span className={styles.name}>
              {isFolder ? item.name : item.name.replace('.md', '')}
            </span>

            {isFolder && <span className={styles.meta}>{item.childCount || 0}</span>}

            {isFolder && (
              <span
                className={styles.moreActionsBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  e.nativeEvent.stopPropagation(); // Stop native bubbling to prevent document click dismissals!
                  const rect = e.currentTarget.getBoundingClientRect();
                  setContextMenu({
                    x: Math.min(rect.left, window.innerWidth - 180),
                    y: Math.min(rect.bottom + 4, window.innerHeight - 200),
                    item,
                  });
                }}
                title="Actions"
              >
                <MoreVertical size={14} />
              </span>
            )}
          </div>

          {isFolder && isExpanded && item.children && renderTreeNode(item.children, depth + 1)}
        </div>
      );
    });
  };

  return (
    <>
      <div
        className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : styles.sidebarOpen}`}
      >
        <div className={styles.sidebarInner}>
        {/* Header */}
        <div className={`${styles.header} ${isSettingsOpen || isTrashOpen ? styles.drillDown : ''}`}>
          {!isSettingsOpen && !isTrashOpen ? (
            <>
              <div className={styles.logoBlock}>
                <span className={styles.logo}>
                  <span className={styles.brandWeb}>Web</span>MD
                </span>
              </div>
              <div className={styles.headerActions}>
                <button
                  className={`${styles.trashBtn} ${isTrashOpen ? styles.activeBtn : ''}`}
                  onClick={handleOpenTrash}
                  title="Trash Bin"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  className={`${styles.settingsBtn} ${isSettingsOpen ? styles.activeBtn : ''}`}
                  onClick={handleOpenSettings}
                  title="Preferences"
                >
                  <Settings size={16} />
                </button>
              </div>
            </>
          ) : (
            <>
              <button className={styles.backBtn} onClick={handleGoBack} title="Go Back">
                <ArrowLeft size={16} />
              </button>
              <div className={styles.titleContainer}>
                <span className={styles.viewTitle}>{isSettingsOpen ? 'Settings' : 'Trash'}</span>
              </div>
            </>
          )}
        </div>

        {/* Content Area */}
        <div className={styles.content}>
          {!isSettingsOpen && !isTrashOpen ? (
            <>
              {/* Note Search Container */}
              <div className={styles.searchContainer}>
                <Search size={14} className={styles.searchIcon} />
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Search file or folder..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Tree navigation */}
              <div
                className={`${styles.treeContainer} ${
                  isDragOverTreeContainer ? styles.dragOverTree : ''
                } treeContainerTouchTarget`}
                onDragOver={onTreeContainerDragOver}
                onDragLeave={onTreeContainerDragLeave}
                onDrop={(e) => onDrop(e, 'root')}
                onContextMenu={(e) => handleContextMenu(e, null)}
              >
                {displayedTreeItems.length === 0 ? (
                  <div className={styles.emptyState}>
                    No notes or folders yet.
                    <br />
                    Right-click here to create one!
                  </div>
                ) : (
                  renderTreeNode(displayedTreeItems)
                )}
              </div>
            </>
          ) : isTrashOpen ? (
            <div className={styles.itemsList}>
              <span className={styles.sectionLabel}>Deleted Archive</span>
              {trashItems.map((item) => (
                <div key={item.path} className={`${styles.sidebarItem} ${styles.trashSidebarItem}`}>
                  <span className={styles.icon}>
                    {item.type === 'folder' ? <Folder size={16} /> : <FileText size={16} />}
                  </span>
                  <span className={styles.name}>{item.name}</span>
                  <div className={styles.itemActions}>
                    <button
                      className={styles.restoreBtn}
                      onClick={() => handleRestoreItem(item)}
                      title="Restore"
                    >
                      <RefreshCw size={12} />
                    </button>
                    <button
                      className={styles.deletePermBtn}
                      onClick={() => handlePermanentDelete(item)}
                      title="Delete Permanently"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {trashItems.length === 0 && <div className={styles.emptyState}>Trash is empty.</div>}
            </div>
          ) : (
            <div className={styles.settingsView}>
              <span className={styles.sectionLabel}>Formatting Theme</span>
              <div className={styles.themeOptions}>
                {[
                  { id: 'dark', label: 'Default Dark' },
                  { id: 'light', label: 'Default Light' },
                  { id: 'sepia', label: 'Sepia Paper' },
                  { id: 'sepia-dark', label: 'Sepia Dark' },
                  { id: 'high-contrast', label: 'High Contrast Light' },
                  { id: 'dark-hc', label: 'High Contrast Dark' },
                  { id: 'gruvbox', label: 'Gruvbox Theme' },
                  { id: 'olive', label: 'Olive Grove' },
                  { id: 'olive-dark', label: 'Olive Grove Dark' },
                  { id: 'hotdog', label: 'Hot Dog Stand' },
                  { id: 'win98', label: 'Windows 98' },
                ].map((th) => (
                  <div
                    key={th.id}
                    className={`${styles.themeOption} ${
                      currentTheme === th.id ? styles.themeOptionActive : ''
                    }`}
                    onClick={() => applyTheme(th.id)}
                  >
                    <span className={styles.themeName}>{th.label}</span>
                    {currentTheme === th.id && <Check size={14} className={styles.checkIcon} />}
                  </div>
                ))}
              </div>

              <span className={styles.sectionLabel}>Security Settings</span>
              <form onSubmit={handlePasswordChange} className={styles.passwordForm}>
                <div className={styles.formGroup}>
                  <label className={styles.inputLabel}>Current Password</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Old Password"
                    className={styles.settingsInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.inputLabel}>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New Password"
                    className={styles.settingsInput}
                  />
                </div>
                {passwordError && <div className={styles.errorBanner}>{passwordError}</div>}
                {passwordSuccess && <div className={styles.successBanner}>Password updated!</div>}
                <button type="submit" className={styles.actionBtn}>
                  <Lock size={14} /> Update Password
                </button>
              </form>

              <span className={styles.sectionLabel}>System Utilities</span>
              <div className={styles.systemDangerZone}>
                <button className={styles.restartBtn} onClick={handleRestartServer}>
                  <RefreshCw size={14} /> Restart Server
                </button>
                <button className={styles.logoutBtn} onClick={handleLogout}>
                  <LogOut size={14} /> Logout Session
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!isSettingsOpen && !isTrashOpen && (
          <div className={styles.footer}>
            <div className={styles.splitActions}>
              <button className={styles.footerActionBtn} onClick={() => handleCreateItem('note')}>
                <Plus size={14} /> Note
              </button>
              <button
                className={styles.footerActionBtn}
                onClick={() => handleCreateItem('folder')}
              >
                <FolderPlus size={14} /> Folder
              </button>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Right-click Context Menu */}
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.item ? (
            <>
              {contextMenu.item.type === 'folder' && (
                <>
                  <div
                    className={styles.contextMenuItem}
                    onClick={() => {
                      handleCreateItem('note', contextMenu.item.path);
                      setContextMenu(null);
                    }}
                  >
                    <Plus size={14} /> New Note
                  </div>
                  <div
                    className={styles.contextMenuItem}
                    onClick={() => {
                      handleCreateItem('folder', contextMenu.item.path);
                      setContextMenu(null);
                    }}
                  >
                    <FolderPlus size={14} /> New Folder
                  </div>
                  <div className={styles.contextMenuDivider} />
                </>
              )}
              <div
                className={styles.contextMenuItem}
                onClick={() => {
                  handleRenameClick(contextMenu.item);
                  setContextMenu(null);
                }}
              >
                <Edit2 size={14} /> Rename
              </div>
              <div
                className={`${styles.contextMenuItem} ${styles.contextMenuItemDanger}`}
                onClick={() => {
                  handleDeleteClick(contextMenu.item);
                  setContextMenu(null);
                }}
              >
                <Trash2 size={14} /> Delete
              </div>
            </>
          ) : (
            <>
              <div
                className={styles.contextMenuItem}
                onClick={() => {
                  handleCreateItem('note', '');
                  setContextMenu(null);
                }}
              >
                <Plus size={14} /> New Note
              </div>
              <div
                className={styles.contextMenuItem}
                onClick={() => {
                  handleCreateItem('folder', '');
                  setContextMenu(null);
                }}
              >
                <FolderPlus size={14} /> New Folder
              </div>
            </>
          )}
        </div>
      )}

      {/* Reusable Prompt Modal */}
      {promptModal?.isOpen && (
        <PromptModal
          isOpen={promptModal.isOpen}
          title={promptModal.title}
          placeholder={promptModal.placeholder}
          defaultValue={promptModal.defaultValue}
          onClose={() => setPromptModal(null)}
          onConfirm={promptModal.onConfirm}
        />
      )}

      {/* Floating Glassmorphic Drag Proxy for Mobile Touch Dragging */}
      {touchDragProxy && (
        <div
          className={styles.mobileDragProxy}
          style={{ top: `${touchDragProxy.y}px`, left: `${touchDragProxy.x}px` }}
        >
          <span className={styles.icon}>
            {touchDragProxy.type === 'folder' ? <Folder size={16} /> : <FileText size={16} />}
          </span>
          <span className={styles.name}>{touchDragProxy.name.replace('.md', '')}</span>
        </div>
      )}
    </>
  );
}
