import { doc, getDoc, updateDoc, writeBatch, collection, getDocs, query, where, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '~/lib/firebase';
import type { ReadStatus, Chapter, LibraryEntry } from '~/types';

const chaptersCol = collection(db, 'chapters');
const readProgressCol = collection(db, 'readProgress');
const libraryEntriesCol = collection(db, 'libraryEntries');

export const statusService = {
  async syncToServer(type: string, data: any) {
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data })
      });
    } catch (e) {
      console.error('Failed to sync to server', e);
    }
  },

  async recalculateLibraryCounts(mangaId: string) {
    const snap = await getDocs(query(chaptersCol, where('mangaId', '==', mangaId)));
    const chapters = snap.docs.map((d) => d.data() as Chapter);
    const unreadCount = chapters.filter(c => c.status !== 'completed').length;
    const viewedCount = chapters.filter(c => c.status !== 'unread').length;

    await updateDoc(doc(libraryEntriesCol, mangaId), {
      unreadCount,
      viewedCount
    });
  },

  async markChapterStatus(chapterId: string, mangaId: string, status: ReadStatus, page: number = 0) {
    const now = new Date().toISOString();

    const chapterSnap = await getDoc(doc(chaptersCol, chapterId));
    if (!chapterSnap.exists()) return;
    const chapter = chapterSnap.data() as Chapter;

    const updates: any = {
      status,
      lastReadPage: page
    };

    if (status === 'viewed') {
      if (!chapter.viewedAt) updates.viewedAt = now;
    } else if (status === 'completed') {
      if (!chapter.viewedAt) updates.viewedAt = now;
      updates.completedAt = now;
      updates.read = true;
    } else if (status === 'unread') {
      updates.read = false;
      updates.lastReadPage = 0;
    }

    const batch = writeBatch(db);

    // In Firestore, if status is 'unread', we can delete completedAt by setting it to deleteField() or undefined.
    // However, merge: true or partial setDoc/updateDoc works. We can use updateDoc.
    batch.update(doc(chaptersCol, chapterId), updates);

    // Update readProgress collection
    const progressDocRef = doc(readProgressCol, chapterId);
    if (status === 'unread') {
      batch.delete(progressDocRef);
    } else {
      batch.set(progressDocRef, {
        chapterId,
        mangaId,
        lastPage: page,
        totalPages: chapter.pageCount || 0,
        completed: status === 'completed',
        lastReadAt: now
      }, { merge: true });
    }

    // Update library metadata
    const entrySnap = await getDoc(doc(libraryEntriesCol, mangaId));
    if (entrySnap.exists()) {
      if (status !== 'unread') {
        batch.update(doc(libraryEntriesCol, mangaId), {
          lastViewedAt: now,
          lastViewedChapterId: chapterId,
          lastViewedPage: page
        });
      }
    }

    await batch.commit();

    if (entrySnap.exists()) {
      await this.recalculateLibraryCounts(mangaId);
    }

    // Fire & forget server sync
    this.syncToServer('chapter_status_update', { chapterId, mangaId, status, page, timestamp: now });
  },

  async markMangaAllRead(mangaId: string) {
    const now = new Date().toISOString();

    const chaptersSnap = await getDocs(query(chaptersCol, where('mangaId', '==', mangaId)));
    const chapters = chaptersSnap.docs.map((d) => d.data() as Chapter);

    const batch = writeBatch(db);

    chapters.forEach((c) => {
      batch.update(doc(chaptersCol, c.id), {
        status: 'completed',
        read: true,
        completedAt: c.completedAt || now,
        viewedAt: c.viewedAt || now
      });
    });

    batch.update(doc(libraryEntriesCol, mangaId), {
      unreadCount: 0,
      viewedCount: chapters.length,
      lastViewedAt: now
    });

    await batch.commit();

    this.syncToServer('manga_mark_all_read', { mangaId, timestamp: now });
  }
};
