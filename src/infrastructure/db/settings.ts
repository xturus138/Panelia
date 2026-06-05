import { db } from '~/db/db';
import type { AppSettings } from '~/domain/types';

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put(settings);
}
