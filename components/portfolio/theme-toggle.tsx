'use client';

import { useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from './button';
import styles from './theme-toggle.module.css';

export function ThemeToggle() {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystem = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem('curation-theme');
      } catch {
        /* Use OS preference when storage is unavailable. */
      }
      const next = saved === 'light' || saved === 'dark' ? saved : media.matches ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      document.documentElement.dataset.curationTheme = next;
    };
    const syncStorage = (event: StorageEvent) => {
      if (event.key !== 'curation-theme' && event.key !== null) return;
      if (event.newValue === 'light' || event.newValue === 'dark') {
        document.documentElement.dataset.theme = event.newValue;
        document.documentElement.dataset.curationTheme = event.newValue;
      } else syncSystem();
    };
    media.addEventListener('change', syncSystem);
    window.addEventListener('storage', syncStorage);
    syncSystem();
    return () => {
      media.removeEventListener('change', syncSystem);
      window.removeEventListener('storage', syncStorage);
    };
  }, []);
  const toggle = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.documentElement.dataset.curationTheme = next;
    try {
      localStorage.setItem('curation-theme', next);
    } catch {
      // 隐私模式等写不进去时，当次切换仍生效
    }
  };

  return (
    <Button icon variant="ghost" onClick={toggle} title="切换明暗主题">
      <span className={styles.lightLabel}>切换为深色主题</span>
      <span className={styles.darkLabel}>切换为浅色主题</span>
      <span className={styles.icons} aria-hidden="true">
        <Moon className={styles.moon} size={18} strokeWidth={1.6} />
        <Sun className={styles.sun} size={18} strokeWidth={1.6} />
      </span>
    </Button>
  );
}
