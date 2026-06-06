import { db } from '~/db/db';
import { BackupData, ImportMode, ValidationResult } from './types';
import { validateBackupShape } from './validators';
import { useSettingsStore } from '~/presentation/stores/settings-store';

export async function exportBackup(): Promise<BackupData> {
  const [
    manga,
    chapters,
    libraryEntries,
    categories,
    readProgress,
    downloadedChapters,
    scrapeSources
  ] = await Promise.all([
    db.manga.toArray(),
    db.chapters.toArray(),
    db.libraryEntries.toArray(),
    db.categories.toArray(),
    db.readProgress.toArray(),
    db.downloadedChapters.toArray(),
    db.scrapeSources.toArray()
  ]);

  const { updateSettings, ...settings } = useSettingsStore.getState();

  return {
    meta: {
      version: 1,
      exportedAt: new Date().toISOString(),
      appVersion: '0.1.0',
      exportedBy: 'file',
    },
    data: {
      manga,
      chapters,
      libraryEntries,
      categories,
      readProgress,
      downloadedChapters,
      scrapeSources,
      settings: settings as any
    }
  };
}

export function validateBackup(backup: unknown): ValidationResult {
  if (!validateBackupShape(backup)) {
    return { valid: false, errors: ['Invalid backup format'] };
  }
  return { valid: true, errors: [] };
}

export async function importBackup(backup: BackupData, mode: ImportMode): Promise<void> {
  const { data } = backup;

  await db.transaction('rw', [
    db.manga,
    db.chapters,
    db.libraryEntries,
    db.categories,
    db.readProgress,
    db.downloadedChapters,
    db.scrapeSources
  ], async () => {
    if (mode === 'replace') {
      await Promise.all([
        db.manga.clear(),
        db.chapters.clear(),
        db.libraryEntries.clear(),
        db.categories.clear(),
        db.readProgress.clear(),
        db.downloadedChapters.clear(),
        db.scrapeSources.clear()
      ]);
    }

    const promises: Promise<any>[] = [];

    if (data.manga?.length > 0) promises.push(db.manga.bulkPut(data.manga));
    if (data.chapters?.length > 0) promises.push(db.chapters.bulkPut(data.chapters));
    if (data.libraryEntries?.length > 0) promises.push(db.libraryEntries.bulkPut(data.libraryEntries));
    if (data.categories?.length > 0) promises.push(db.categories.bulkPut(data.categories));
    if (data.readProgress?.length > 0) promises.push(db.readProgress.bulkPut(data.readProgress));
    if (data.downloadedChapters?.length > 0) promises.push(db.downloadedChapters.bulkPut(data.downloadedChapters));
    if (data.scrapeSources?.length > 0) promises.push(db.scrapeSources.bulkPut(data.scrapeSources));

    await Promise.all(promises);
  });

  if (data.settings && Object.keys(data.settings).length > 0) {
    useSettingsStore.getState().updateSettings(data.settings);
  }
}
