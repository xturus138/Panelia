import { collection, doc, getDocs, query, setDoc, deleteDoc, where } from 'firebase/firestore';
import { db } from '~/lib/firebase';
import type { AppSettings } from '~/domain/types';

const settingsDocRef = doc(db, 'settings', 'app-settings');

export async function saveSettings(settings: AppSettings): Promise<void> {
  await setDoc(settingsDocRef, settings, { merge: true });
}

export async function getSettings(): Promise<AppSettings | undefined> {
  const { getDoc } = await import('firebase/firestore');
  const snap = await getDoc(settingsDocRef);
  return snap.exists() ? (snap.data() as AppSettings) : undefined;
}
