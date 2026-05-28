'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './PromptModal.module.css';

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  placeholder: string;
  defaultValue: string;
  onClose: () => void;
  onConfirm: (value: string) => void | Promise<void>;
}

export default function PromptModal({
  isOpen,
  title,
  placeholder,
  defaultValue,
  onClose,
  onConfirm,
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;

    setSubmitting(true);
    try {
      await onConfirm(value.trim());
      onClose();
    } catch (err) {
      console.error('[PromptModal] Error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <input
              type="text"
              className={styles.input}
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              disabled={submitting}
              autoFocus
            />
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className={styles.createBtn} disabled={submitting || !value.trim()}>
              {submitting ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
