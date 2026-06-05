import { db } from '~/db/db';
import type { ScrapeSource } from '~/services/scrape/types';

export async function getScrapeSourceById(id: string): Promise<ScrapeSource | undefined> {
  return db.scrapeSources.get(id) as Promise<ScrapeSource | undefined>;
}

export async function saveScrapeSource(source: ScrapeSource): Promise<void> {
  await db.scrapeSources.put(source);
}
