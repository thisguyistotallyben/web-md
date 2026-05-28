'use client';

import React, { useState } from 'react';
import { BookOpen, Lock, AlertCircle } from 'lucide-react';
import styles from './Login.module.css';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        onLoginSuccess();
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logoIcon}>
          <BookOpen size={44} strokeWidth={1.5} />
        </div>
        <h1 className={styles.title}>WebMD Workspace</h1>
        <p className={styles.subtitle}>Enter your password to access your markdown library</p>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Security Passkey</label>
            <div className={styles.inputWrapper}>
              {/* Hidden username field for mobile keychain/password manager detection */}
              <input
                type="text"
                name="username"
                defaultValue="admin"
                style={{ display: 'none' }}
                autoComplete="username"
              />
              <input
                type="password"
                id="password"
                name="password"
                className={styles.input}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                autoFocus
                disabled={loading}
              />
            </div>
            {error && (
              <div className={styles.errorText}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <button type="submit" className={styles.button} disabled={loading || !password}>
            {loading ? (
              <>
                <div className={styles.loadingSpinner} />
                <span>Entering Workspace...</span>
              </>
            ) : (
              <>
                <Lock size={16} />
                <span>Access Notes</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
