import { describe, expect, it } from 'vitest';
import { statusService as legacyStatusService } from '~/services/statusService';
import { statusService as infrastructureStatusService } from '~/infrastructure/services';

describe('service compatibility', () => {
  it('re-exports the same status service instance', () => {
    expect(legacyStatusService).toBe(infrastructureStatusService);
  });
});