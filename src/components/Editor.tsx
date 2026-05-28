'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import Placeholder from '@tiptap/extension-placeholder';
import Superscript from '@tiptap/extension-superscript';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { all, createLowlight } from 'lowlight';

import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Quote,
  Menu,
  List,
  ListOrdered,
  Code,
  Undo,
  Redo,
  FileText,
  Trash2,
  Edit,
  Eye,
  ChevronDown,
  CloudCheck, // Wait, Lucide React might not have CloudCheck, let's use Cloud, Check, Loader or generic icons to be safe
  Check,
  Cloud,
  Loader,
  MoreVertical
} from 'lucide-react';
import styles from './Editor.module.css';

const lowlight = createLowlight(all);

interface EditorProps {
  notePath: string | null;
  initialBody: string;
  noteName: string;
  onSave: (path: string, content: string) => Promise<void>;
  onToggleSidebar: () => void;
  onDeleteNote: (path: string) => Promise<void>;
  onRenameNote: (oldPath: string, newName: string) => Promise<void>;
  isSidebarCollapsed: boolean;
  onSetSidebarCollapsed: (collapsed: boolean) => void;
}

export default function Editor({
  notePath,
  initialBody,
  noteName,
  onSave,
  onToggleSidebar,
  onDeleteNote,
  onRenameNote,
  isSidebarCollapsed,
  onSetSidebarCollapsed,
}: EditorProps) {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [isRawMode, setIsRawMode] = useState(false);
  const [rawText, setRawText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);
  const [indicatorStatus, setIndicatorStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [editTitle, setEditTitle] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);
  const onSaveRef = useRef(onSave);
  const notePathRef = useRef(notePath);
  const isRawModeRef = useRef(isRawMode);
  const rawTextRef = useRef(rawText);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  // Update refs to prevent stale closure bugs in timers
  useEffect(() => {
    onSaveRef.current = onSave;
    notePathRef.current = notePath;
    isRawModeRef.current = isRawMode;
    rawTextRef.current = rawText;
  }, [onSave, notePath, isRawMode, rawText]);

  // Handle click outside of Note Actions menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Synchronize when switching notes
  useEffect(() => {
    setIsRawMode(false);
    setSaveStatus('saved');
    setIsMenuOpen(false);
    setShowIndicator(false);
    setEditTitle(noteName.replace(/\.md$/, ''));
  }, [notePath, noteName]);

  // Control save indicator visibility and timeouts
  useEffect(() => {
    if (saveStatus === 'saving') {
      setIndicatorStatus('saving');
      setShowIndicator(true);
    } else if (saveStatus === 'saved') {
      setIndicatorStatus('saved');
      setShowIndicator(true);
      const timer = setTimeout(() => {
        setShowIndicator(false);
      }, 1500); // Overlay notes momentarily (1.5 seconds)
      return () => clearTimeout(timer);
    } else if (saveStatus === 'dirty') {
      setIndicatorStatus('dirty');
      setShowIndicator(false); // Hide the indicator while user is typing to avoid cluttering writable area
    }
  }, [saveStatus]);

  // Initialize TipTap Editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Markdown.configure({
        markedOptions: {
          gfm: true,
        },
      } as any),
      Placeholder.configure({
        placeholder: 'Write something amazing in markdown...',
      }),
      Superscript,
      CodeBlockLowlight.configure({
        lowlight,
      }),
    ],
    content: initialBody,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        class: styles.tiptapEditor,
      },
    },
    onUpdate({ editor }) {
      setSaveStatus('dirty');
      triggerAutoSave();
    },
  }, [notePath]);

  // Handle initialBody loads or shifts
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(initialBody, {
        emitUpdate: false,
        contentType: 'markdown',
      });
    }
    setRawText(initialBody);
  }, [editor, initialBody]);

  // Debounced auto-saving timer
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAutoSave = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    setSaveStatus('dirty');
    autoSaveTimerRef.current = setTimeout(async () => {
      if (!notePathRef.current) return;
      setSaveStatus('saving');
      try {
        const content = isRawModeRef.current
          ? rawTextRef.current
          : (editor ? editor.getMarkdown() : '');
        
        await onSaveRef.current(notePathRef.current, content);
        setSaveStatus('saved');
      } catch (err) {
        console.error('[AutoSave] Failed:', err);
        setSaveStatus('dirty');
      }
    }, 800); // 800ms autosave debounce
  };

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Prevent closing tab with unsaved items
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'dirty' || saveStatus === 'saving') {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);

  const handleToggleRawMode = () => {
    if (!editor) return;

    if (isRawMode) {
      // Switching from Raw Markdown back to WYSIWYG
      editor.commands.setContent(rawText, {
        emitUpdate: false,
        contentType: 'markdown',
      });
      setIsRawMode(false);
      // Trigger instant save to sync
      setSaveStatus('dirty');
      triggerAutoSave();
    } else {
      // Switching from WYSIWYG to Raw Markdown
      const currentMd = editor.getMarkdown();
      setRawText(currentMd);
      setIsRawMode(true);
    }
    setIsMenuOpen(false); // Close the Note Actions menu
  };

  const handleRawChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawText(val);
    setSaveStatus('dirty');
    triggerAutoSave();
  };

  const handleRename = () => {
    if (!notePath) return;
    const cleanName = editTitle.trim();
    const isNote = notePath.endsWith('.md');
    const currentDisplayName = isNote ? noteName.replace(/\.md$/, '') : noteName;

    if (cleanName && cleanName !== currentDisplayName) {
      const finalName = isNote ? (cleanName.endsWith('.md') ? cleanName : `${cleanName}.md`) : cleanName;
      onRenameNote(notePath, finalName).catch((err) => {
        console.error('[HeaderRename] Failed:', err);
        setEditTitle(currentDisplayName);
      });
    } else {
      setEditTitle(currentDisplayName);
    }
  };



  const handleDeleteNote = () => {
    if (!notePath) return;
    if (confirm(`Are you sure you want to delete "${noteName.replace('.md', '')}"?`)) {
      onDeleteNote(notePath);
    }
    setIsMenuOpen(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const touch = e.touches[0];
    const diffX = touchStartXRef.current - touch.clientX;
    const diffY = touchStartYRef.current - touch.clientY;

    // Check if horizontal swipe rather than vertical scroll
    if (Math.abs(diffX) > Math.abs(diffY)) {
      // 1. If sidebar is collapsed (closed), swipe from left to right (diffX < -60) starting on the left portion of screen to open it
      if (isSidebarCollapsed && diffX < -60 && touchStartXRef.current < 200) {
        onSetSidebarCollapsed(false); // Open sidebar
        touchStartXRef.current = null;
        touchStartYRef.current = null;
      }
      // 2. If sidebar is open, swipe from right to left (diffX > 60) to close it
      else if (!isSidebarCollapsed && diffX > 60) {
        onSetSidebarCollapsed(true); // Close sidebar
        touchStartXRef.current = null;
        touchStartYRef.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  return (
    <div
      className={styles.editorWrapper}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className={styles.editorContainer}>
        {/* Editor Header Bar */}
        <header
          className={styles.editorHeader}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <button
            onClick={onToggleSidebar}
            className={styles.headerBtn}
            title="Toggle Sidebar"
          >
            <Menu size={18} />
          </button>

          {notePath ? (
            <>
              {/* TipTap Action buttons */}
              {!isRawMode && editor && (
                <div className={styles.headerToolbar}>
                  <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`${styles.toolbarBtn} ${editor.isActive('bold') ? styles.toolbarBtnActive : ''}`}
                    title="Bold"
                  >
                    <Bold size={15} />
                  </button>
                  <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`${styles.toolbarBtn} ${editor.isActive('italic') ? styles.toolbarBtnActive : ''}`}
                    title="Italic"
                  >
                    <Italic size={15} />
                  </button>
                  <button
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    className={`${styles.toolbarBtn} ${editor.isActive('strike') ? styles.toolbarBtnActive : ''}`}
                    title="Strikethrough"
                  >
                    <Strikethrough size={15} />
                  </button>

                  <div className={styles.divider} />

                  <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={`${styles.toolbarBtn} ${editor.isActive('heading', { level: 1 }) ? styles.toolbarBtnActive : ''}`}
                    title="Heading 1"
                  >
                    <Heading1 size={15} />
                  </button>
                  <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={`${styles.toolbarBtn} ${editor.isActive('heading', { level: 2 }) ? styles.toolbarBtnActive : ''}`}
                    title="Heading 2"
                  >
                    <Heading2 size={15} />
                  </button>

                  <div className={styles.divider} />

                  <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`${styles.toolbarBtn} ${editor.isActive('bulletList') ? styles.toolbarBtnActive : ''}`}
                    title="Bullet List"
                  >
                    <List size={15} />
                  </button>
                  <button
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`${styles.toolbarBtn} ${editor.isActive('orderedList') ? styles.toolbarBtnActive : ''}`}
                    title="Ordered List"
                  >
                    <ListOrdered size={15} />
                  </button>

                  <div className={styles.divider} />

                  <button
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={`${styles.toolbarBtn} ${editor.isActive('blockquote') ? styles.toolbarBtnActive : ''}`}
                    title="Blockquote"
                  >
                    <Quote size={15} />
                  </button>

                  <button
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    className={`${styles.toolbarBtn} ${editor.isActive('codeBlock') ? styles.toolbarBtnActive : ''}`}
                    title="Code Block"
                  >
                    <Code size={15} />
                  </button>

                  <div className={styles.divider} />

                  <button
                    onClick={() => editor.chain().focus().undo().run()}
                    className={styles.toolbarBtn}
                    title="Undo"
                  >
                    <Undo size={15} />
                  </button>
                  <button
                    onClick={() => editor.chain().focus().redo().run()}
                    className={styles.toolbarBtn}
                    title="Redo"
                  >
                    <Redo size={15} />
                  </button>
                </div>
              )}

              {/* Right side controls (Note actions menu) */}
              <div className={styles.rightHeaderControls}>
                <div ref={menuRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className={styles.headerBtn}
                    title="Note Actions"
                  >
                    <MoreVertical size={18} />
                  </button>

                  {isMenuOpen && (
                    <div className={styles.popoverMenu}>
                      <button className={styles.menuItem} onClick={handleToggleRawMode}>
                        <Eye size={14} /> {isRawMode ? 'Edit Rich Text' : 'Edit Raw MD'}
                      </button>
                      <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={handleDeleteNote}>
                        <Trash2 size={14} /> Delete Note
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </header>

        {/* Editor Body */}
        <div className={styles.editorBody}>
          {!notePath ? (
            <div className={styles.welcomeCardContainer}>
              <div className={styles.welcomeCard}>
                <FileText size={48} className={styles.welcomeIcon} />
                <h2 className={styles.welcomeTitle}>Welcome to WebMD</h2>
                <p className={styles.welcomeSubtitle}>
                  Select an existing note from the sidebar or start a new note/folder down below to begin writing.
                </p>
              </div>
            </div>
          ) : (
            <div className={styles.writableArea}>
              {/* Floating Glassmorphic Save Indicator Overlay - positioned relative to writableArea */}
              <div
                className={`${styles.floatingSaveIndicator} ${
                  showIndicator ? styles.indicatorVisible : styles.indicatorHidden
                }`}
              >
                {indicatorStatus === 'saved' && (
                  <span className={styles.statusSaved}>
                    <Check size={14} /> Saved
                  </span>
                )}
                {indicatorStatus === 'saving' && (
                  <span className={styles.statusSaving}>
                    <Loader size={14} className={styles.spinner} /> Saving...
                  </span>
                )}
                {indicatorStatus === 'dirty' && (
                  <span className={styles.statusDirty}>
                    <Cloud size={14} /> Unsaved
                  </span>
                )}
              </div>

              {/* Note Header Title Input - inline at top of writable canvas */}
              <input
                type="text"
                className={styles.titleInput}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                placeholder="Untitled Note"
              />

              {isRawMode ? (
                <textarea
                  className={styles.rawTextarea}
                  value={rawText}
                  onChange={handleRawChange}
                  placeholder="Type your markdown content directly here..."
                />
              ) : (
                <div className={styles.richTextContainer}>
                  <EditorContent editor={editor} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
