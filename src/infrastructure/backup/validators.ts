import { BackupData } from './types';

export function validateBackupShape(data: unknown): data is BackupData {
  if (!data || typeof data !== 'object') return false;
  const d = data as any;
  return (
    typeof d.version === 'number' &&
    typeof d.metadata === 'object' &&
    typeof d.data === 'object'
  );
}
