import { BackupData } from './types';

export function migrateBackup(data: unknown): BackupData {
  return data as BackupData;
}
