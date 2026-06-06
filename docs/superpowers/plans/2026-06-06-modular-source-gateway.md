# Modular Source Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one root source gateway that routes all source access through isolated source modules, so adding a new source means adding or changing one source module only.

**Architecture:** Split source concerns into per-source modules with a shared provider contract and a root-level gateway/registry that is the only entrypoint the app uses. Keep static providers, scrape providers, and future providers behind a common adapter layer so the gateway can discover, register, and resolve them without source-specific conditionals leaking into app code.

**Tech Stack:** TypeScript, Next.js app router, Vitest, existing `SourceProvider` contract, existing `src/infrastructure/sources` and `src/services/sources` code.

---

### Task 1: Lock gateway contract and module boundaries

**Files:**
- Modify: `src/domain/interfaces/source-provider.ts:1-10`
- Modify: `src/infrastructure/sources/registry.ts:1-100`
- Test: `src/infrastructure/sources/registry.test.ts`

- [ ] **Step 1: Write failing contract tests**

```ts
import { describe, it, expect } from 'vitest';
import { sourceRegistry } from '~/infrastructure/sources/registry';

describe('source gateway contract', () => {
  it('exposes only normalized source ids', () => {
    expect(sourceRegistry.getProviderIds()).toContain('mangadex');
    expect(sourceRegistry.getProviderIds()).toContain('comick');
  });

  it('resolves providers by id without app-side source branching', () => {
    const provider = sourceRegistry.get('mangadex');
    expect(provider).not.toBeNull();
    expect(provider?.getPopular).toBeTypeOf('function');
  });
});
```

- [ ] **Step 2: Run test and confirm current gateway shape is not enough**

Run: `pnpm vitest src/infrastructure/sources/registry.test.ts -v`
Expected: fail or highlight missing gateway assertions until the new module boundary API exists.

- [ ] **Step 3: Update provider contract to support module isolation**

```ts
import type { Manga, Chapter, Page } from '~/domain/types';

export interface SourceProvider {
  readonly id: string;
  readonly name: string;
  getPopular(page: number): Promise<Manga[]>;
  getLatest(page: number): Promise<Manga[]>;
  search(query: string, page: number): Promise<Manga[]>;
  getMangaDetails(id: string): Promise<Manga>;
  getChapters(mangaId: string): Promise<Chapter[]>;
  getPages(chapterId: string): Promise<Page[]>;
}
```

- [ ] **Step 4: Run test and confirm contract compiles**

Run: `pnpm vitest src/infrastructure/sources/registry.test.ts -v`
Expected: pass after provider modules expose `id` and `name`.

- [ ] **Step 5: Commit**

```bash
git add src/domain/interfaces/source-provider.ts src/infrastructure/sources/registry.ts src/infrastructure/sources/registry.test.ts
git commit -m "feat: define modular source gateway contract"
```

### Task 2: Move each static source into own module

**Files:**
- Create: `src/services/sources/mangadex/module.ts`
- Create: `src/services/sources/comick/module.ts`
- Modify: `src/services/sources/mangadex.ts`
- Modify: `src/services/sources/comick.ts`
- Modify: `src/services/sources/index.ts`
- Modify: `src/infrastructure/sources/registry.ts`
- Test: `src/services/sources/smoke-domain-contracts.test.ts`

- [ ] **Step 1: Write failing smoke test for module exports**

```ts
import { describe, it, expect } from 'vitest';
import { mangadexModule } from '~/services/sources/mangadex/module';
import { comickModule } from '~/services/sources/comick/module';

describe('source modules', () => {
  it('export isolated module definitions', () => {
    expect(mangadexModule.id).toBe('mangadex');
    expect(comickModule.id).toBe('comick');
    expect(mangadexModule.provider.getPopular).toBeTypeOf('function');
    expect(comickModule.provider.getPopular).toBeTypeOf('function');
  });
});
```

- [ ] **Step 2: Run test to see missing modules fail**

Run: `pnpm vitest src/services/sources/smoke-domain-contracts.test.ts -v`
Expected: fail with missing module exports.

- [ ] **Step 3: Create per-source module wrappers**

```ts
import { mangadexProvider } from './mangadex';

export const mangadexModule = {
  id: 'mangadex',
  name: 'MangaDex',
  provider: mangadexProvider,
};
```

```ts
import { comickProvider } from './comick';

export const comickModule = {
  id: 'comick',
  name: 'Comick',
  provider: comickProvider,
};
```

- [ ] **Step 4: Move registry to consume modules only**

```ts
import { mangadexModule } from '~/services/sources/mangadex/module';
import { comickModule } from '~/services/sources/comick/module';

const STATIC_PROVIDER_MODULES = [mangadexModule, comickModule];
```

- [ ] **Step 5: Run tests and confirm registry still resolves both sources**

Run: `pnpm vitest src/infrastructure/sources/registry.test.ts src/services/sources/smoke-domain-contracts.test.ts -v`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/services/sources/mangadex/module.ts src/services/sources/comick/module.ts src/services/sources/mangadex.ts src/services/sources/comick.ts src/services/sources/index.ts src/infrastructure/sources/registry.ts src/services/sources/smoke-domain-contracts.test.ts
git commit -m "feat: isolate static sources into modules"
```

### Task 3: Add root gateway API for app consumption

**Files:**
- Create: `src/infrastructure/sources/gateway.ts`
- Modify: `src/infrastructure/sources/index.ts`
- Modify: `src/services/sources/index.ts`
- Modify: `src/presentation/hooks/use-manga-details.ts`
- Modify: `src/presentation/hooks/use-reader-chapter.ts`
- Modify: `src/services/downloads/download-manager.ts`
- Modify: `src/db/sync.ts`
- Test: `src/infrastructure/sources/gateway.test.ts`

- [ ] **Step 1: Write gateway tests that use one entrypoint**

```ts
import { describe, it, expect } from 'vitest';
import { sourceGateway } from '~/infrastructure/sources/gateway';

describe('source gateway', () => {
  it('lists source modules', () => {
    expect(sourceGateway.list().map(s => s.id)).toEqual(expect.arrayContaining(['mangadex', 'comick']));
  });

  it('resolves provider by id', () => {
    expect(sourceGateway.getProvider('mangadex')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test and confirm gateway file does not exist yet**

Run: `pnpm vitest src/infrastructure/sources/gateway.test.ts -v`
Expected: fail because gateway file is missing.

- [ ] **Step 3: Create gateway wrapper**

```ts
import { sourceRegistry } from './registry';

export const sourceGateway = {
  list() {
    return sourceRegistry.getAllProviders();
  },
  getProvider(id: string) {
    return sourceRegistry.get(id);
  },
  registerModule(module: { id: string; name: string; provider: unknown }) {
    sourceRegistry.register(module.id, module.provider as never);
  },
};
```

- [ ] **Step 4: Switch app code to gateway only**

Replace direct `sourceRegistry`/source imports with `sourceGateway` in hooks, sync, and download flows. Keep all source selection logic in gateway helpers, not app components.

- [ ] **Step 5: Run full source tests**

Run: `pnpm vitest src/infrastructure/sources/*.test.ts src/services/sources/*.test.ts -v`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/sources/gateway.ts src/infrastructure/sources/index.ts src/services/sources/index.ts src/presentation/hooks/use-manga-details.ts src/presentation/hooks/use-reader-chapter.ts src/services/downloads/download-manager.ts src/db/sync.ts src/infrastructure/sources/gateway.test.ts
git commit -m "feat: add root source gateway"
```

### Task 4: Make new source onboarding module-only

**Files:**
- Modify: `src/infrastructure/sources/registry.ts`
- Modify: `src/services/extensions.ts`
- Modify: `src/services/scrape/presets.ts`
- Modify: `src/services/scrape/scrapeAdapter.ts`
- Test: `src/infrastructure/sources/registry.test.ts`

- [ ] **Step 1: Write onboarding test that adds source through module API only**

```ts
import { describe, it, expect } from 'vitest';
import { sourceGateway } from '~/infrastructure/sources/gateway';

describe('module-only onboarding', () => {
  it('registers new module without touching app consumers', () => {
    const module = {
      id: 'test-source',
      name: 'Test Source',
      provider: {
        id: 'test-source',
        name: 'Test Source',
        getPopular: async () => [],
        getLatest: async () => [],
        search: async () => [],
        getMangaDetails: async () => ({ } as never),
        getChapters: async () => [],
        getPages: async () => [],
      },
    };

    sourceGateway.registerModule(module);
    expect(sourceGateway.getProvider('test-source')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test and confirm module registration path works**

Run: `pnpm vitest src/infrastructure/sources/registry.test.ts -v`
Expected: pass once registry accepts new modules.

- [ ] **Step 3: Add doc note at gateway boundary**

```ts
/**
 * Source gateway rule:
 * - app code reads only from sourceGateway
 * - source-specific logic stays inside module files
 * - onboarding a new source means adding one module and registering it here
 */
```

- [ ] **Step 4: Run full source suite**

Run: `pnpm vitest src/infrastructure/sources/*.test.ts src/services/sources/*.test.ts -v`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/sources/registry.ts src/services/extensions.ts src/services/scrape/presets.ts src/services/scrape/scrapeAdapter.ts src/infrastructure/sources/registry.test.ts
git commit -m "feat: make source onboarding module-driven"
```

### Task 5: Verify no source logic leaks outside gateway

**Files:**
- Test: `src/infrastructure/sources/no-leak.test.ts`
- Modify: any leftover direct import sites found by the test

- [ ] **Step 1: Write leak detection test**

```ts
import { describe, it, expect } from 'vitest';
import { glob } from 'node:fs/promises';

describe('source gateway boundary', () => {
  it('keeps source usage behind gateway imports', async () => {
    const files = await glob('src/**/*.{ts,tsx}');
    expect(files).toBeDefined();
  });
});
```

- [ ] **Step 2: Replace generic test with real boundary assertions**

Check imports for `mangadexProvider`, `comickProvider`, `ScrapeAdapter`, or `sourceRegistry` outside `src/infrastructure/sources/**` and fail on direct use.

- [ ] **Step 3: Run tests and fix leaks**

Run: `pnpm vitest src/infrastructure/sources/no-leak.test.ts -v`
Expected: fail first, then pass after any direct imports are moved behind `sourceGateway`.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/sources/no-leak.test.ts
 git commit -m "test: enforce source gateway boundary"
```

### Task 6: Final verification and cleanup

**Files:**
- Modify: any source files changed by tasks above
- Test: all source tests

- [ ] **Step 1: Run focused source tests**

Run: `pnpm vitest src/infrastructure/sources/*.test.ts src/services/sources/*.test.ts -v`
Expected: pass.

- [ ] **Step 2: Run app-level type check and build if available**

Run: `pnpm lint` and `pnpm build`
Expected: no source-related regressions.

- [ ] **Step 3: Review diff for direct source imports**

Confirm app code imports only `sourceGateway` or gateway helpers.

- [ ] **Step 4: Commit final cleanup**

```bash
git add -A
git commit -m "refactor: route sources through modular gateway"
```
