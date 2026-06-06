import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '~/lib/firebase';
import type { BackupData, ValidationResult, ImportMode } from './types';
import { validateBackupShape } from './validators';
import { useSettingsStore } from '~/presentation/stores/settings-store';

const supportedVersion = 1;

export async function exportBackup(): Promise<BackupData> {
  const collections = ['manga', 'chapters', 'libraryEntries', 'categories', 'readProgress', 'downloadedChapters', 'scrapeSources'] as const;
  const data: any = {};

  for (const name of collections) {
    const snap = await getDocs(collection(db, name));
    data[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  const settingsSnap = await getDoc(doc(db, 'settings', 'app-settings'));
  data.settings = settingsSnap.exists() ? settingsSnap.data() : {};

  const { updateSettings, ...settings } = useSettingsStore.getState();

  return {
    meta: {
      version: supportedVersion,
      exportedAt: new Date().toISOString(),
      appVersion: '0.1.0',
      exportedBy: 'file',
    },
    data: {
      manga: data.manga || [],
      chapters: data.chapters || [],
      libraryEntries: data.libraryEntries || [],
      categories: data.categories || [],
      readProgress: data.readProgress || [],
      downloadedChapters: data.downloadedChapters || [],
      scrapeSources: data.scrapeSources || [],
      settings: data.settings || settings,
    },
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

  const writeOps: Promise<void>[] = [];

  const collections = [
    { name: 'manga', items: data.manga },
    { name: 'chapters', items: data.chapters },
    { name: 'libraryEntries', items: data.libraryEntries },
    { name: 'categories', items: data.categories },
    { name: 'readProgress', items: data.readProgress },
    { name: 'downloadedChapters', items: data.downloadedChapters },
    { name: 'scrapeSources', items: data.scrapeSources },
  ] as const;

  if (mode === 'replace') {
    for (const { name } of collections) {
      const existingSnap = await getDocs(collection(db, name));
      existingSnap.docs.forEach((d) => {
        deleteDoc(d.ref);
      });
    }
  }

  for (const { name, items } of collections) {
    if (items && items.length > 0) {
      for (const item of items) {
        const id = (item as any).id || (item as any).mangaId;
        if (id) {
          writeOps.push(setDoc(doc(db, name, id), item, { merge: true }));
        }
      }
    }
  }

  await Promise.all(writeOps);

  if (data.settings && Object.keys(data.settings).length > 0) {
    await setDoc(doc(db, 'settings', 'app-settings'), data.settings, { merge: true });
    useSettingsStore.getState().updateSettings(data.settings as any);
  }
}
