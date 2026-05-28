'use client';

import React, { useEffect, useState } from 'react';
import Login from '@/components/Login';
import WebMDApp from '@/components/WebMDApp';
import styles from '@/components/WebMDApp.module.css';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/verify');
      if (res.ok) {
        const data = await res.json();
        setAuthenticated(data.authenticated);
      }
    } catch (err) {
      console.error('[CheckAuth] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <span className={styles.loadingText}>Opening WebMD workspace...</span>
      </div>
    );
  }

  if (!authenticated) {
    return <Login onLoginSuccess={() => setAuthenticated(true)} />;
  }

  return <WebMDApp onLogoutSuccess={() => setAuthenticated(false)} />;
}
