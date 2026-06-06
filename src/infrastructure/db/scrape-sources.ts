import { collection, doc, getDoc, setDoc } from './db-gateway';
import { db } from '~/lib/firebase';
import type { ScrapeSource } from '~/services/scrape/types';
import { userScopedCollection, userScopedDoc } from './user-scope';

export async function getScrapeSourceById(uid: string, id: string): Promise<ScrapeSource | undefined> {
  const snap = await getDoc(userScopedDoc(uid, 'scrapeSources', id));
  return snap.exists() ? (snap.data() as ScrapeSource) : undefined;
}

export async function saveScrapeSource(uid: string, source: ScrapeSource): Promise<void> {
  await setDoc(userScopedDoc(uid, 'scrapeSources', source.id), source, { merge: true });
}
