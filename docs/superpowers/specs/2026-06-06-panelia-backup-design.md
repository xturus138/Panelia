# Backup Module Design

**Date:** 2026-06-06
**Status:** Approved
**Target:** Backup (export/import) feature as a standalone module, future-ready for Firebase

---

## 1. Goals

Design a modular backup system that:
- Exports all user data as a versioned JSON file
- Imports with user choice: Replace (wipe + restore) or Merge (add missing, skip duplicates)
- Warns user before import, with "backup first" recommendation
- Supports file download/upload immediately
- Provides infrastructure for Firebase sync (future)

---

## 2. Non-Goals

- Firebase implementation (adapter stub only)
- Cloud sync on app launch
- Automatic background backup
- Selective backup (backup only specific sections)

---

## 3. Module Structure

```
src/infrastructure/backup/
├── types.ts              # BackupData, ImportMode, BackupAdapter interfaces
├── backup.service.ts     # Core export/import logic
├── file-adapter.ts       # Browser JSON download/upload
├── firebase-adapter.ts   # Firebase Firestore stub (future)
├── migration.ts          # Version handling for migrations
├── validators.ts         # Backup integrity checks
└── index.ts              # Public exports
```

---

## 4. Data Structure

```typescript
// types.ts
export interface BackupMeta {
  version: number;          // 1, 2, 3... for migrations
  exportedAt: string;       // ISO timestamp
  appVersion: string;      // e.g. "0.1.0"
  exportedBy: 'file';      // | 'firebase' (future)
}

export interface BackupData {
  meta: BackupMeta;
  data: {
    manga: Manga[];
    chapters: Chapter[];
    libraryEntries: LibraryEntry[];
    categories: Category[];
    readProgress: ReadProgress[];
    downloadedChapters: DownloadedChapter[];
    scrapeSources: ScrapeSource[];
    settings: AppSettings;
  };
}

export type ImportMode = 'replace' | 'merge';
export type BackupAdapter = 'file' | 'firebase';
```

---

## 5. Backup Service

### 5.1 Export

```typescript
async exportBackup(): Promise<BackupData>
// Reads all Dexie tables + settings
// Returns versioned BackupData object
// Does NOT include blobs for downloaded chapters (metadata only for size)
```

### 5.2 Import

```typescript
async importBackup(backup: BackupData, mode: ImportMode): Promise<void>
// - 'replace': clears all tables, then bulk inserts backup data
// - 'merge': skips existing records (by ID), adds new ones only
// Runs in a Dexie transaction (atomic)
```

### 5.3 Validation

```typescript
async validateBackup(backup: unknown): Promise<ValidationResult>
// Checks:
// - Is valid JSON structure
// - Has required meta fields
// - Has required data tables
// - Version is supported
// Returns: { valid: boolean; errors: string[] }
```

---

## 6. Adapters

### 6.1 File Adapter (immediate)

```typescript
// downloadBackup(backup, filename?) -> triggers browser download
// uploadBackup(file) -> reads File, parses JSON, returns BackupData
```

### 6.2 Firebase Adapter (stub for future)

```typescript
// pushBackup(backup, userId) -> Promise<void> (NOT IMPLEMENTED)
// pullBackup(userId) -> Promise<BackupData | null> (NOT IMPLEMENTED)
// isEnabled() -> boolean (returns false until Firebase added)
```

---

## 7. Migration Strategy

- `version: 1` — current format
- Migration logic checks version on import
- If version > supported, show error: "Backup was created with a newer app version. Please update Panelia."
- Future: add `migrateV1toV2()` functions as versions increment

---

## 8. UI Integration

### 8.1 Settings Page (Backup Section)

Located in `src/app/settings/page.tsx` (or new `backup` sub-section):

**Export:**
- "Create Backup" button → triggers export + download
- Shows last backup timestamp (stored in settings)

**Import:**
- File picker input
- On file selected → show confirmation dialog

**Import Confirmation Dialog:**
- Warning: "This will [replace/merge] your library data"
- Recommendation: "Consider creating a backup first if you haven't recently"
- Two options:
  - "Replace" radio (wipes existing, restores backup)
  - "Merge" radio (adds new items, keeps existing)
- "Cancel" and "Import" buttons

### 8.2 Firebase Stub UI

- "Cloud Backup" section with toggle (disabled, grayed)
- "Coming soon with Firebase integration" label

---

## 9. Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid file (not JSON) | Toast error: "Invalid backup file" |
| Version mismatch | Toast error: "Unsupported backup version" |
| Partial import fail | Rollback transaction, toast error |
| No data to import | Toast info: "Backup is empty" |
| File too large (>100MB) | Toast warning: "Backup is very large" |

---

## 10. Dependency Rules

- `src/infrastructure/backup/` may depend on:
  - `src/domain/types/` (types only)
  - `src/db/db.ts` (Dexie instance)
  - `src/store/useSettingsStore.ts` (for last backup timestamp)
- Must NOT depend on:
  - `src/presentation/` (no React imports)
  - `src/services/` (except for existing backup.ts during migration)
  - UI components

---

## 11. Migration from Existing backup.ts

1. Create new `src/infrastructure/backup/` module
2. Move/rename/export the existing `backupService` into `backup.service.ts`
3. Update imports in pages that use `backupService`
4. Delete `src/services/backup.ts` after migration verified
5. Ensure `backup.service.ts` is the single source of truth

---

## 12. Success Criteria

- [ ] Export downloads valid JSON file
- [ ] Import Replace wipes + restores correctly
- [ ] Import Merge adds new, skips duplicates
- [ ] Validation rejects malformed files
- [ ] Warning dialog shown before import
- [ ] Firebase adapter stub in place
- [ ] No React imports in infrastructure layer
- [ ] Tests for backup.service.ts pass

---

## 13. Files to Create/Modify

### Create:
- `src/infrastructure/backup/types.ts`
- `src/infrastructure/backup/backup.service.ts`
- `src/infrastructure/backup/file-adapter.ts`
- `src/infrastructure/backup/firebase-adapter.ts`
- `src/infrastructure/backup/migration.ts`
- `src/infrastructure/backup/validators.ts`
- `src/infrastructure/backup/index.ts`

### Modify:
- `src/app/settings/page.tsx` — add backup UI section

### Delete (after migration verified):
- `src/services/backup.ts`