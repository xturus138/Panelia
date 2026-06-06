import { BackupData } from './types';
export * from './types';
export * from './validators';
export * from './migration';

// Stubs for test validation
export async function createBackup(): Promise<BackupData> {
  throw new Error('Not implemented');
}

export async function restoreBackup(data: unknown): Promise<void> {
  throw new Error('Not implemented');
}
