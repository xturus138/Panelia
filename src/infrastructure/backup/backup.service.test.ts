import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportBackup, importBackup, validateBackup } from './backup.service';

vi.mock('~/lib/firebase', () => ({
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({
    exists: () => true,
    data: () => ({ theme: 'dark' }),
  }),
  getDocs: vi.fn().mockResolvedValue({
    docs: [{
      id: 'm1',
      data: () => ({ id: 'm1' }),
    }],
  }),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));

const mockUpdateSettings = vi.fn();

vi.mock('~/presentation/stores/settings-store', () => ({
  useSettingsStore: {
    getState: () => ({
      theme: 'dark',
      readerMode: 'webtoon',
      readingDirection: 'ltr',
      pageFitMode: 'fit-width',
      libraryViewMode: 'grid',
      languageFilter: 'all',
      showNsfw: false,
      updateSettings: mockUpdateSettings,
    }),
  },
}));

describe('Backup Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exportBackup', () => {
    it('should query all tables and build a BackupData object', async () => {
      const result = await exportBackup();

      expect(result.meta.version).toBe(1);
      expect(result.meta.exportedBy).toBe('file');
      expect(result.meta.exportedAt).toBeTruthy();
      expect(result.data.manga).toEqual([{ id: 'm1' }]);
      expect(result.data.settings).toHaveProperty('theme');
    });
  });

  describe('importBackup', () => {
    const mockBackup = {
      meta: { version: 1, exportedAt: '2026-06-06T00:00:00.000Z', appVersion: '0.1.0', exportedBy: 'file' as const },
      data: {
        manga: [{ id: 'm1' }],
        chapters: [],
        libraryEntries: [],
        categories: [],
        readProgress: [],
        settings: { theme: 'light', readerMode: 'webtoon', readingDirection: 'ltr', pageFitMode: 'fit-width', libraryViewMode: 'grid', languageFilter: 'all', showNsfw: false },
        downloadedChapters: [],
        scrapeSources: [],
      }
    };

    it('should use replace mode properly', async () => {
      await importBackup(mockBackup as any, 'replace');
      expect(mockUpdateSettings).toHaveBeenCalled();
    });

    it('should use merge mode properly', async () => {
      await importBackup(mockBackup as any, 'merge');
      expect(mockUpdateSettings).toHaveBeenCalled();
    });
  });

  describe('validateBackup', () => {
    it('should return invalid for null', () => {
      expect(validateBackup(null)).toEqual({ valid: false, errors: ['Invalid backup format'] });
    });

    it('should return valid for correct shape', () => {
      const valid = {
        meta: { version: 1, exportedAt: '2026-06-06', appVersion: '0.1.0', exportedBy: 'file' },
        data: { manga: [], chapters: [], libraryEntries: [], categories: [], readProgress: [], downloadedChapters: [], scrapeSources: [], settings: {} }
      };
      expect(validateBackup(valid)).toEqual({ valid: true, errors: [] });
    });
  });
});
