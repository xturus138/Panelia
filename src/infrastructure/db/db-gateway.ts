/**
 * Firestore Gateway
 *
 * Single entry point for ALL Firestore operations.
 * Every file in the app imports Firestore primitives from here,
 * never directly from 'firebase/firestore'.
 *
 * Why: if Firestore SDK changes, swaps, or gets replaced,
 * only this file needs updating — zero consumer impact.
 */

// ── Low-level Firestore primitives ─────────────────────────────
export {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  onSnapshot,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';

// ── Firestore lifecycle / admin ops ────────────────────────────
export {
  terminate,
  clearIndexedDbPersistence,
} from 'firebase/firestore';
