import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, type DocumentData, type QueryConstraint } from 'firebase/firestore';
import { db } from '~/lib/firebase';

/**
 * Reactively listen to a Firestore collection with optional query constraints.
 * Returns undefined while loading, T[] on data.
 */
export function useFirestoreCollection<T = DocumentData>(
  collectionName: string,
  ...constraints: QueryConstraint[]
) {
  const [data, setData] = useState<T[] | undefined>(undefined);

  useEffect(() => {
    const q = constraints.length > 0
      ? query(collection(db, collectionName), ...constraints)
      : collection(db, collectionName);

    const unsub = onSnapshot(q, (snap) => {
      setData(snap.docs.map((d) => ({ ...d.data(), id: d.id } as unknown as T)));
    });

    return unsub;
  }, [collectionName, ...constraints]);

  return data;
}

/**
 * Reactively listen to a single Firestore document.
 * Returns undefined while loading, T | null on data.
 */
export function useFirestoreDoc<T = DocumentData>(collectionName: string, docId: string | undefined) {
  const [data, setData] = useState<T | null | undefined>(undefined);

  useEffect(() => {
    if (!docId) {
      setData(null);
      return;
    }

    const unsub = onSnapshot(doc(db, collectionName, docId), (snap) => {
      setData(snap.exists() ? (snap.data() as T) : null);
    });

    return unsub;
  }, [collectionName, docId]);

  return data;
}
