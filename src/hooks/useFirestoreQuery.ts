import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, type DocumentData, type QueryConstraint } from '~/infrastructure/db/db-gateway';
import { db } from '~/lib/firebase';

/**
 * Reactively listen to a Firestore collection with optional query constraints.
 * Returns undefined while loading, T[] on data.
 */
export function useFirestoreCollection<T = DocumentData>(
  uid: string | null,
  collectionName: string,
  ...constraints: QueryConstraint[]
) {
  const [data, setData] = useState<T[] | undefined>(undefined);

  useEffect(() => {
    if (!uid) {
      setData(undefined);
      return;
    }

    const base = collection(db, 'users', uid, collectionName);
    const q = constraints.length > 0 ? query(base, ...constraints) : base;

    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ ...d.data(), id: d.id } as unknown as T)));
      },
      (err) => {
        console.error(`Firestore collection listener failed for ${collectionName}:`, err);
        setData([] as T[]);
      }
    );

    return unsub;
  }, [uid, collectionName, ...constraints]);

  return data;
}

/**
 * Reactively listen to a single Firestore document.
 * Returns undefined while loading, T | null on data.
 */
export function useFirestoreDoc<T = DocumentData>(uid: string | null, collectionName: string, docId: string | undefined) {
  const [data, setData] = useState<T | null | undefined>(undefined);

  useEffect(() => {
    if (!uid) {
      setData(null);
      return;
    }

    if (!docId) {
      setData(null);
      return;
    }

    const unsub = onSnapshot(doc(db, 'users', uid, collectionName, docId), (snap) => {
      setData(snap.exists() ? (snap.data() as T) : null);
    });

    return unsub;
  }, [uid, collectionName, docId]);

  return data;
}
