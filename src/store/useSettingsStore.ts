import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings } from '~/types';

interface SettingsState extends AppSettings {
  updateSettings: (settings: Partial<AppSettings>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      readerMode: 'vertical-scroll',
      readingDirection: 'ltr',
      pageFitMode: 'fit-width',
      libraryViewMode: 'grid',
      brightness: 100,
      languageFilter: 'all',
      showNsfw: false,
      updateSettings: (newSettings) => set((state) => ({ ...state, ...newSettings })),
    }),
    {
      name: 'panelia-settings',
    }
  )
);