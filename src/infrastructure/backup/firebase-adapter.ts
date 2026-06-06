import type { BackupData } from './types';

export const firebaseAdapter = {
  isEnabled() {
    return false;
  },

  async pushBackup(_backup: BackupData, _userId: string): Promise<void> {
    throw new Error('Firebase backup not implemented');
  },

  async pullBackup(_userId: string): Promise<BackupData | null> {
    return null;
  },
};
