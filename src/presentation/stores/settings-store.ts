import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings } from '~/domain/types';

interface SettingsState extends AppSettings {
  lastBackupAt: string | null;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      readerMode: 'webtoon',
      readingDirection: 'ltr',
      pageFitMode: 'fit-width',
      libraryViewMode: 'grid',
      lastBackupAt: null,
      updateSettings: (newSettings) => set((state) => ({ ...state, ...newSettings })),
    }),
    {
      name: 'panelia-settings',
    }
  )
);