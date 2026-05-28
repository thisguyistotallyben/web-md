'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Editor from './Editor';
import styles from './WebMDApp.module.css';

interface WebMDAppProps {
  onLogoutSuccess: () => void;
}

export default function WebMDApp({ onLogoutSuccess }: WebMDAppProps) {
  const [activeNotePath, setActiveNotePath] = useState<string | null>(null);
  const [activeNoteContent, setActiveNoteContent] = useState<string>('');
  const [activeNoteName, setActiveNoteName] = useState<string>('Welcome');
  const [loadingNote, setLoadingNote] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [treeItems, setTreeItems] = useState<any[]>([]);

  // Initial load
  useEffect(() => {
    refreshTree();
    
    // Set viewport dimensions and handle resizing
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsSidebarCollapsed(false);
      } else {
        setIsSidebarCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const refreshTree = async () => {
    try {
      const res = await fetch('/api/fs?path=');
      if (res.ok) {
        const data = await res.json();
        setTreeItems(data);
      }
    } catch (err) {
      console.error('[WebMDApp] Failed to load files tree:', err);
    }
  };

  const handleSelectNote = async (path: string) => {
    if (!path) {
      setActiveNotePath(null);
      setActiveNoteContent('');
      setActiveNoteName('Welcome');
      return;
    }

    setLoadingNote(true);
    try {
      const res = await fetch(`/api/fs/read?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        setActiveNotePath(path);
        setActiveNoteContent(data.content || '');
        const filename = path.split('/').pop() || 'Untitled';
        setActiveNoteName(filename);
        
        // Auto collapse sidebar on mobile
        if (window.innerWidth <= 768) {
          setIsSidebarCollapsed(true);
        }
      }
    } catch (err) {
      console.error('[WebMDApp] Failed to read note:', err);
    } finally {
      setLoadingNote(false);
    }
  };

  const handleSaveNote = async (path: string, content: string) => {
    try {
      const res = await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content }),
      });
      if (!res.ok) {
        console.error('[WebMDApp] Save failed');
      }
    } catch (err) {
      console.error('[WebMDApp] Error saving note:', err);
    }
  };

  const handleDeleteNote = async (path: string) => {
    try {
      const res = await fetch('/api/fs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (res.ok) {
        // If the active note was deleted, reset selection
        if (activeNotePath === path) {
          setActiveNotePath(null);
          setActiveNoteContent('');
          setActiveNoteName('Welcome');
        }
        refreshTree();
      }
    } catch (err) {
      console.error('[WebMDApp] Failed to delete note:', err);
    }
  };

  const handleRenameNote = async (oldPath: string, newName: string) => {
    try {
      const res = await fetch('/api/fs/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath, newName }),
      });
      if (res.ok) {
        // Recalculate paths
        const parentPath = oldPath.split('/').slice(0, -1).join('/');
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;
        
        if (activeNotePath === oldPath) {
          setActiveNotePath(newPath);
          setActiveNoteName(newName);
        }
        refreshTree();
      } else {
        throw new Error('Rename request failed');
      }
    } catch (err) {
      console.error('[WebMDApp] Failed to rename note:', err);
      throw err;
    }
  };

  return (
    <div className={styles.appContainer}>
      {/* Mobile sidebar overlay backdrop */}
      <div
        className={`${styles.backdrop} ${!isSidebarCollapsed ? styles.backdropActive : ''}`}
        onClick={() => setIsSidebarCollapsed(true)}
      />

      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        activeNotePath={activeNotePath}
        treeItems={treeItems}
        onSelectNote={handleSelectNote}
        onRefreshTree={refreshTree}
        onLogoutSuccess={onLogoutSuccess}
        onRenameItem={handleRenameNote}
        onDeleteItem={handleDeleteNote}
      />

      <main className={styles.mainContent}>
        {loadingNote ? (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingSpinner} />
            <span className={styles.loadingText}>Reading note content...</span>
          </div>
        ) : (
          <Editor
            notePath={activeNotePath}
            initialBody={activeNoteContent}
            noteName={activeNoteName}
            onSave={handleSaveNote}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            onDeleteNote={handleDeleteNote}
            onRenameNote={handleRenameNote}
            isSidebarCollapsed={isSidebarCollapsed}
            onSetSidebarCollapsed={setIsSidebarCollapsed}
          />
        )}
      </main>
    </div>
  );
}
