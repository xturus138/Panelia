import { describe, expect, it } from 'vitest';
import { useSettingsStore } from '~/presentation/stores/settings-store';
import { useReaderStore } from '~/presentation/stores/reader-store';
import { useToastStore } from '~/presentation/stores/toast-store';

describe('presentation stores', () => {
  it('exposes consolidated Zustand stores', () => {
    expect(useSettingsStore.getState().readerMode).toBeTruthy();
    expect(useReaderStore.getState().isReaderOpen).toBe(false);
    expect(Array.isArray(useToastStore.getState().toasts)).toBe(true);
  });
});