import { describe, it, expect } from 'vitest';

describe('Backup Module Shape', () => {
  it('should export the expected types and functions', async () => {
    const backupModule = await import('./index');

    expect(backupModule).toHaveProperty('validateBackupShape');
    expect(backupModule).toHaveProperty('migrateBackup');
    expect(backupModule).toHaveProperty('createBackup');
    expect(backupModule).toHaveProperty('restoreBackup');

    // Test that the functions are actually functions (even if stubbed for now)
    expect(typeof backupModule.validateBackupShape).toBe('function');
    expect(typeof backupModule.migrateBackup).toBe('function');
    expect(typeof backupModule.createBackup).toBe('function');
    expect(typeof backupModule.restoreBackup).toBe('function');
  });
});
