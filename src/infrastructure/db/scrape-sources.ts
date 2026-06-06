import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '~/lib/firebase';
import type { ScrapeSource } from '~/services/scrape/types';

const scrapeSourceCol = collection(db, 'scrapeSources');

export async function getScrapeSourceById(id: string): Promise<ScrapeSource | undefined> {
  const snap = await getDoc(doc(scrapeSourceCol, id));
  return snap.exists() ? (snap.data() as ScrapeSource) : undefined;
}

export async function saveScrapeSource(source: ScrapeSource): Promise<void> {
  await setDoc(doc(scrapeSourceCol, source.id), source, { merge: true });
}
