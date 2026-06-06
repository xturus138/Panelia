import { doc, getDoc, setDoc, deleteDoc } from '~/infrastructure/db/db-gateway';
import { db } from '~/lib/firebase';
import type { BackupData } from './types';

const BACKUPS_COL = 'backups';

export const firebaseAdapter = {
  isEnabled() {
    return true;
  },

  async pushBackup(backup: BackupData, userId: string): Promise<void> {
    await setDoc(
      doc(db, BACKUPS_COL, `${userId}__latest`),
      { backup, exportedAt: new Date().toISOString() },
      { merge: true },
    );
  },

  async pullBackup(userId: string): Promise<BackupData | null> {
    const snap = await getDoc(doc(db, BACKUPS_COL, `${userId}__latest`));
    if (!snap.exists()) return null;
    const data = snap.data();
    return (data?.backup as BackupData) ?? null;
  },
};
