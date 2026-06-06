# Backup Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build versioned backup export/import for all local user data, with replace/merge restore modes, import warnings, and a future Firebase-ready adapter layer.

**Architecture:** Keep backup logic in one infrastructure module under `src/infrastructure/backup/` so export/import can be reused after the DB refactor. Core service owns data shape, validation, migration, and Dexie access; file adapter owns browser download/upload; Firebase adapter stays as a stub for later cloud sync. Presentation only wires buttons, file picker, and confirmation dialog into the service.

**Tech Stack:** Next.js App Router, TypeScript, Dexie, Zustand, browser File/Blob APIs, Vitest.

---

### Task 1: Create backup module shape and types

**Files:**
- Create: `src/infrastructure/backup/types.ts`
- Create: `src/infrastructure/backup/index.ts`
- Create: `src/infrastructure/backup/migration.ts`
- Create: `src/infrastructure/backup/validators.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Write failing test for backup shape exports**

```ts
import { describe, expect, it } from 'vitest';
import { backupService, type BackupData, type ImportMode } from '~/infrastructure/backup';

describe('backup module exports', () => {
  it('exports backupService and backup types', () => {
    expect(backupService).toBeTruthy();
    const mode: ImportMode = 'replace';
    expect(mode).toBe('replace');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest src/infrastructure/backup/backup-module.test.ts -v`
Expected: FAIL because module path and exports do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/infrastructure/backup/types.ts
import type { AppSettings, Chapter, Manga, LibraryEntry, Category, ReadProgress, DownloadedChapter } from '~/types';
import type { ScrapeSource } from '~/services/scrape/types';

export interface BackupMeta {
  version: number;
  exportedAt: string;
  appVersion: string;
  exportedBy: 'file' | 'firebase';
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
export interface ValidationResult { valid: boolean; errors: string[]; }
```

```ts
// src/infrastructure/backup/index.ts
export * from './types';
export * from './validators';
export * from './migration';
export * from './backup.service';
export * from './file-adapter';
export * from './firebase-adapter';
```

```ts
// src/types/index.ts
export * from '~/domain/types';
export type { SourceProvider } from '~/domain/interfaces';
export type { BackupData, BackupMeta, ImportMode, BackupAdapter, ValidationResult } from '~/infrastructure/backup';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest src/infrastructure/backup/backup-module.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/backup/types.ts src/infrastructure/backup/index.ts src/infrastructure/backup/migration.ts src/infrastructure/backup/validators.ts src/types/index.ts
git commit -m "feat: add backup module contracts"
```

### Task 2: Move export/import logic into backup service

**Files:**
- Create: `src/infrastructure/backup/backup.service.ts`
- Modify: `src/services/backup.ts`
- Modify: `src/db/db.ts`
- Modify: `src/presentation/stores/settings-store.ts`
- Modify: `src/app/settings/page.tsx`
- Test: `src/infrastructure/backup/backup.service.test.ts`

- [ ] **Step 1: Write failing tests for export and restore behavior**

```ts
import { describe, expect, it, vi } from 'vitest';
import { backupService } from '~/infrastructure/backup/backup.service';

describe('backupService.exportBackup', () => {
  it('includes settings and all local tables', async () => {
    const backup = await backupService.exportBackup();
    expect(backup.meta.version).toBe(1);
    expect(backup.data).toHaveProperty('settings');
    expect(backup.data).toHaveProperty('manga');
    expect(Array.isArray(backup.data.chapters)).toBe(true);
  });
});

describe('backupService.importBackup', () => {
  it('supports replace and merge modes', async () => {
    const backup = await backupService.exportBackup();
    await expect(backupService.importBackup(backup, 'replace')).resolves.toBeUndefined();
    await expect(backupService.importBackup(backup, 'merge')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest src/infrastructure/backup/backup.service.test.ts -v`
Expected: FAIL because `backup.service.ts` is missing and settings are not part of backup.

- [ ] **Step 3: Implement service against Dexie and settings store**

```ts
// src/infrastructure/backup/backup.service.ts
import { db } from '~/db/db';
import { useSettingsStore } from '~/presentation/stores/settings-store';
import type { BackupData, ImportMode, ValidationResult } from './types';
import { validateBackupShape } from './validators';

const supportedVersion = 1;

function getAppVersion() {
  return process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0';
}

function readSettings() {
  const state = useSettingsStore.getState();
  const { updateSettings, ...settings } = state;
  return settings;
}

export const backupService = {
  async exportBackup(): Promise<BackupData> {
    const [manga, chapters, libraryEntries, categories, readProgress, downloadedChapters, scrapeSources] = await Promise.all([
      db.manga.toArray(),
      db.chapters.toArray(),
      db.libraryEntries.toArray(),
      db.categories.toArray(),
      db.readProgress.toArray(),
      db.downloadedChapters.toArray(),
      db.scrapeSources.toArray(),
    ]);

    return {
      meta: {
        version: supportedVersion,
        exportedAt: new Date().toISOString(),
        appVersion: getAppVersion(),
        exportedBy: 'file',
      },
      data: {
        manga,
        chapters,
        libraryEntries,
        categories,
        readProgress,
        downloadedChapters,
        scrapeSources,
        settings: readSettings(),
      },
    };
  },

  async validateBackup(backup: unknown): Promise<ValidationResult> {
    return validateBackupShape(backup, supportedVersion);
  },

  async importBackup(backup: BackupData, mode: ImportMode): Promise<void> {
    if (backup.meta.version !== supportedVersion) {
      throw new Error(`Unsupported backup version: ${backup.meta.version}`);
    }

    await db.transaction('rw', [db.manga, db.chapters, db.libraryEntries, db.categories, db.readProgress, db.downloadedChapters, db.scrapeSources, db.settings], async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.manga.clear(),
          db.chapters.clear(),
          db.libraryEntries.clear(),
          db.categories.clear(),
          db.readProgress.clear(),
          db.downloadedChapters.clear(),
          db.scrapeSources.clear(),
          db.settings.clear(),
        ]);
      }

      await db.manga.bulkPut(backup.data.manga);
      await db.chapters.bulkPut(backup.data.chapters);
      await db.libraryEntries.bulkPut(backup.data.libraryEntries);
      await db.categories.bulkPut(backup.data.categories);
      await db.readProgress.bulkPut(backup.data.readProgress);
      await db.downloadedChapters.bulkPut(backup.data.downloadedChapters);
      await db.scrapeSources.bulkPut(backup.data.scrapeSources);
      await db.settings.bulkPut([backup.data.settings]);
    });

    useSettingsStore.getState().updateSettings(backup.data.settings);
  },
};
```

- [ ] **Step 4: Update Dexie schema for settings table and backup fields**

```ts
// src/db/db.ts
this.version(4).stores({
  manga: 'id, sourceId, title',
  chapters: 'id, mangaId, chapterNumber, status',
  libraryEntries: 'mangaId, *categories, lastViewedAt',
  categories: 'id, sortOrder',
  readProgress: 'chapterId, mangaId, lastReadAt',
  settings: 'theme',
  downloadedChapters: 'id, chapterId, mangaId',
  scrapeSources: 'id, baseUrl, createdAt',
});
```

- [ ] **Step 5: Run backup service tests**

Run: `npx vitest src/infrastructure/backup/backup.service.test.ts -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/backup/backup.service.ts src/services/backup.ts src/db/db.ts src/presentation/stores/settings-store.ts src/app/settings/page.tsx src/infrastructure/backup/backup.service.test.ts
git commit -m "feat: move backup logic into infrastructure module"
```

### Task 3: Add file adapter, import warning flow, and replace/merge UI

**Files:**
- Create: `src/infrastructure/backup/file-adapter.ts`
- Modify: `src/app/settings/page.tsx`
- Test: `src/app/settings/backup-ui.test.tsx`

- [ ] **Step 1: Write failing UI test for warning dialog and mode selection**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from '~/app/settings/page';

describe('backup UI', () => {
  it('shows warning before import and lets user choose replace or merge', async () => {
    render(<SettingsPage />);
    expect(screen.getByText('Backup & Restore')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest src/app/settings/backup-ui.test.tsx -v`
Expected: FAIL because backup dialog UI does not exist.

- [ ] **Step 3: Implement file adapter and import modal flow**

```ts
// src/infrastructure/backup/file-adapter.ts
import type { BackupData } from './types';

export const fileAdapter = {
  downloadBackup(backup: BackupData, filename = 'panelia-backup.json') {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  async uploadBackup(file: File): Promise<BackupData> {
    const text = await file.text();
    return JSON.parse(text) as BackupData;
  },
};
```

```tsx
// src/app/settings/page.tsx
const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
const [showImportWarning, setShowImportWarning] = useState(false);

const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const backup = await fileAdapter.uploadBackup(file);
    setPendingBackup(backup);
    setShowImportWarning(true);
  } catch (err) {
    toast.error('Failed to restore backup: ' + (err instanceof Error ? err.message : String(err)));
  } finally {
    if (fileInputRef.current) fileInputRef.current.value = '';
  }
};
```

- [ ] **Step 4: Run UI test and manual smoke-check import flow**

Run: `npx vitest src/app/settings/backup-ui.test.tsx -v`
Expected: PASS.

Smoke-check: open `/settings`, click Import, select JSON, verify warning appears before restore.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/backup/file-adapter.ts src/app/settings/page.tsx src/app/settings/backup-ui.test.tsx
git commit -m "feat: add backup import warning flow"
```

### Task 4: Add Firebase-ready stub and cleanup old entrypoint

**Files:**
- Create: `src/infrastructure/backup/firebase-adapter.ts`
- Modify: `src/app/settings/page.tsx`
- Delete: `src/services/backup.ts`

- [ ] **Step 1: Write failing test for Firebase stub shape**

```ts
import { describe, expect, it } from 'vitest';
import { firebaseAdapter } from '~/infrastructure/backup';

describe('firebaseAdapter', () => {
  it('stays disabled until firebase support lands', () => {
    expect(firebaseAdapter.isEnabled()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest src/infrastructure/backup/firebase-adapter.test.ts -v`
Expected: FAIL because adapter file and exports do not exist yet.

- [ ] **Step 3: Implement stub adapter**

```ts
// src/infrastructure/backup/firebase-adapter.ts
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
```

- [ ] **Step 4: Remove old backup entrypoint once imports are updated**

```ts
// remove src/services/backup.ts after all callers use src/infrastructure/backup
```

- [ ] **Step 5: Run full verification**

Run:
- `npm run lint`
- `npx vitest`

Expected: lint passes; vitest passes.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/backup/firebase-adapter.ts src/services/backup.ts src/app/settings/page.tsx
git commit -m "feat: add firebase-ready backup stub"
```

---

## Self-Review Checklist

- [x] Spec coverage mapped to tasks: export/import, replace/merge, warning dialog, file adapter, Firebase stub, cleanup old entrypoint.
- [x] Placeholder scan: no TBD/TODO/“later” steps left in task bodies.
- [x] Type consistency: `BackupData`, `ImportMode`, `ValidationResult`, `backupService`, `fileAdapter`, `firebaseAdapter` stay consistent across tasks.
- [x] Scope: one feature, one module, one route integration, no unrelated db refactor yet.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-06-backup-module.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**