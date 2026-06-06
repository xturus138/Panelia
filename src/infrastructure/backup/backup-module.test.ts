import { describe, it, expect } from 'vitest';

describe('Backup Module Shape', () => {
  it('should export the expected types and functions', async () => {
    const backupModule = await import('./index');

    expect(backupModule).toHaveProperty('validateBackupShape');
    expect(backupModule).toHaveProperty('migrateBackup');
    expect(backupModule).toHaveProperty('exportBackup');
    expect(backupModule).toHaveProperty('importBackup');
    expect(backupModule).toHaveProperty('validateBackup');

    expect(typeof backupModule.validateBackupShape).toBe('function');
    expect(typeof backupModule.migrateBackup).toBe('function');
    expect(typeof backupModule.exportBackup).toBe('function');
    expect(typeof backupModule.importBackup).toBe('function');
    expect(typeof backupModule.validateBackup).toBe('function');
  });
});
