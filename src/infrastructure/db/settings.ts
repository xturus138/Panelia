import { doc, getDoc, setDoc } from './db-gateway';
import { db } from '~/lib/firebase';
import type { AppSettings } from '~/domain/types';
import { userSettingsDoc } from './user-scope';

export async function saveSettings(uid: string, settings: AppSettings): Promise<void> {
  await setDoc(userSettingsDoc(uid), settings, { merge: true });
}

export async function getSettings(uid: string): Promise<AppSettings | undefined> {
  const snap = await getDoc(userSettingsDoc(uid));
  return snap.exists() ? (snap.data() as AppSettings) : undefined;
}
