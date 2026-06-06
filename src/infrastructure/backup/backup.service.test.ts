import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportBackup, importBackup, validateBackup } from './backup.service';
import { db } from '~/db/db';

vi.mock('~/db/db', () => ({
  db: {
    transaction: vi.fn((_mode: string, _tables: any[], cb: () => Promise<void>) => cb()),
    manga: { toArray: vi.fn().mockResolvedValue([]), clear: vi.fn(), bulkPut: vi.fn() },
    chapters: { toArray: vi.fn().mockResolvedValue([]), clear: vi.fn(), bulkPut: vi.fn() },
    libraryEntries: { toArray: vi.fn().mockResolvedValue([]), clear: vi.fn(), bulkPut: vi.fn() },
    categories: { toArray: vi.fn().mockResolvedValue([]), clear: vi.fn(), bulkPut: vi.fn() },
    readProgress: { toArray: vi.fn().mockResolvedValue([]), clear: vi.fn(), bulkPut: vi.fn() },
    downloadedChapters: { toArray: vi.fn().mockResolvedValue([]), clear: vi.fn(), bulkPut: vi.fn() },
    scrapeSources: { toArray: vi.fn().mockResolvedValue([]), clear: vi.fn(), bulkPut: vi.fn() },
  }
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
      brightness: 100,
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
      vi.mocked(db.manga.toArray).mockResolvedValue([{ id: 'm1' } as any]);

      const result = await exportBackup();

      expect(db.manga.toArray).toHaveBeenCalled();
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
        settings: { theme: 'light', readerMode: 'webtoon', readingDirection: 'ltr', pageFitMode: 'fit-width', libraryViewMode: 'grid', brightness: 100, languageFilter: 'all', showNsfw: false },
        downloadedChapters: [],
        scrapeSources: [],
      }
    };

    it('should use replace mode properly', async () => {
      await importBackup(mockBackup as any, 'replace');

      expect(db.transaction).toHaveBeenCalled();
      expect(db.manga.clear).toHaveBeenCalled();
      expect(db.manga.bulkPut).toHaveBeenCalledWith([{ id: 'm1' }]);
      expect(mockUpdateSettings).toHaveBeenCalled();
    });

    it('should use merge mode properly', async () => {
      await importBackup(mockBackup as any, 'merge');

      expect(db.transaction).toHaveBeenCalled();
      expect(db.manga.clear).not.toHaveBeenCalled();
      expect(db.manga.bulkPut).toHaveBeenCalledWith([{ id: 'm1' }]);
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
