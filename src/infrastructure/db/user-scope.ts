import { collection, doc } from './db-gateway';
import { db } from '~/lib/firebase';

export function userScopedCollection(uid: string, name: string) {
  return collection(db, 'users', uid, name);
}

export function userScopedDoc(uid: string, collectionName: string, docId: string) {
  return doc(db, 'users', uid, collectionName, docId);
}

export function userSettingsDoc(uid: string) {
  return doc(db, 'users', uid, 'settings', 'app-settings');
}
