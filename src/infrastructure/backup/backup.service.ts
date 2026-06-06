import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, writeBatch } from '~/infrastructure/db/db-gateway';
import { db } from '~/lib/firebase';
import { auth } from '~/lib/firebase';
import type { BackupData, ValidationResult, ImportMode } from './types';
import { validateBackupShape } from './validators';
import { useSettingsStore } from '~/presentation/stores/settings-store';

const supportedVersion = 1;

function requireUid(): string {
  const u = auth.currentUser?.uid;
  if (!u) throw new Error('Login required');
  return u;
}

export async function exportBackup(): Promise<BackupData> {
  const uid = requireUid();
  const collections = ['manga', 'chapters', 'libraryEntries', 'categories', 'readProgress', 'downloadedChapters', 'scrapeSources'] as const;
  const data: any = {};

  for (const name of collections) {
    const snap = await getDocs(collection(db, 'users', uid, name));
    data[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  const settingsSnap = await getDoc(doc(db, 'users', uid, 'settings', 'app-settings'));
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

function getId(item: Record<string, unknown>): string | null {
  const id = item.id ?? item.mangaId;
  return id ? String(id) : null;
}

export async function importBackup(backup: BackupData, mode: ImportMode): Promise<void> {
  const uid = requireUid();
  const { data } = backup;

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
    const batch = writeBatch(db);
    for (const { name } of collections) {
      const existingSnap = await getDocs(collection(db, 'users', uid, name));
      existingSnap.docs.forEach((d) => {
        batch.delete(d.ref);
      });
    }
    await batch.commit();
  }

  const batch = writeBatch(db);
  for (const { name, items } of collections) {
    if (items && items.length > 0) {
      for (const item of items) {
        const id = getId(item as unknown as Record<string, unknown>);
        if (id) {
          batch.set(doc(db, 'users', uid, name, id), item, { merge: mode === 'merge' });
        }
      }
    }
  }
  await batch.commit();

  if (data.settings && Object.keys(data.settings).length > 0) {
    await setDoc(doc(db, 'users', uid, 'settings', 'app-settings'), data.settings, { merge: true });
    useSettingsStore.getState().updateSettings(data.settings as any);
  }
}
