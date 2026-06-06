import { doc, getDoc, updateDoc, writeBatch, collection, getDocs, query, where, setDoc, deleteDoc } from '~/infrastructure/db/db-gateway';
import { db } from '~/lib/firebase';
import type { ReadStatus, Chapter, LibraryEntry } from '~/types';
import { userScopedCollection, userScopedDoc } from '~/infrastructure/db/user-scope';

export const statusService = {
  async syncToServer(uid: string, type: string, data: any) {
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, type, data })
      });
    } catch (e) {
      console.error('Failed to sync to server', e);
    }
  },

  async recalculateLibraryCounts(uid: string, mangaId: string) {
    const chaptersCol = userScopedCollection(uid, 'chapters');
    const snap = await getDocs(query(chaptersCol, where('mangaId', '==', mangaId)));
    const chapters = snap.docs.map((d) => d.data() as Chapter);
    const unreadCount = chapters.filter(c => c.status !== 'completed').length;
    const viewedCount = chapters.filter(c => c.status !== 'unread').length;

    await updateDoc(userScopedDoc(uid, 'libraryEntries', mangaId), {
      unreadCount,
      viewedCount
    });
  },

  async markChapterStatus(uid: string, chapterId: string, mangaId: string, status: ReadStatus, page: number = 0) {
    const now = new Date().toISOString();

    const chaptersCol = userScopedCollection(uid, 'chapters');
    const readProgressCol = userScopedCollection(uid, 'readProgress');
    const libraryEntriesCol = userScopedCollection(uid, 'libraryEntries');

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

    batch.update(doc(chaptersCol, chapterId), updates);

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
      await this.recalculateLibraryCounts(uid, mangaId);
    }

    this.syncToServer(uid, 'chapter_status_update', { chapterId, mangaId, status, page, timestamp: now });
  },

  async markMangaAllRead(uid: string, mangaId: string) {
    const now = new Date().toISOString();

    const chaptersCol = userScopedCollection(uid, 'chapters');
    const libraryEntriesCol = userScopedCollection(uid, 'libraryEntries');

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

    this.syncToServer(uid, 'manga_mark_all_read', { mangaId, timestamp: now });
  }
};
