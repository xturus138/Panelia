import { describe, it } from 'vitest';
import { comixProvider } from './comix';
import fs from 'fs';

describe('comix debug', () => {
  it('searches for daughter', async () => {
    const res = await comixProvider.search('daughter');
    fs.writeFileSync('comix-debug-output.json', JSON.stringify(res, null, 2));
  });
});