import type { BackupData } from './types';

export const fileAdapter = {
  downloadBackup(backup: BackupData, filename = 'panelia-backup.json') {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async uploadBackup(file: File): Promise<BackupData> {
    const text = await file.text();
    return JSON.parse(text) as BackupData;
  },
};
