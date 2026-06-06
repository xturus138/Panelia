import { BackupData } from './types';

export function validateBackupShape(data: unknown): data is BackupData {
  if (!data || typeof data !== 'object') return false;
  const d = data as any;
  return (
    d.meta &&
    typeof d.meta === 'object' &&
    typeof d.meta.version === 'number' &&
    typeof d.meta.exportedAt === 'string' &&
    typeof d.meta.appVersion === 'string' &&
    (d.meta.exportedBy === 'file' || d.meta.exportedBy === 'firebase') &&
    d.data &&
    typeof d.data === 'object'
  );
}
