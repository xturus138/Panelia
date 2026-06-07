import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFirestoreCollection } from '~/hooks/useFirestoreQuery';
import { getDoc, doc, collection, getDocs, query, where } from '~/infrastructure/db/db-gateway';
import { db as firestore } from '~/lib/firebase';
import { isInLibrary, toggleInLibrary } from '~/infrastructure/db/library';
import { sourceGateway } from '~/infrastructure/sources';
import { statusService } from '~/infrastructure/services';
import { useReaderStore } from '~/presentation/stores';
import { getScrapeSession } from '~/services/scrape/sessionStore';
import { ScrapeAdapter } from '~/services/scrape/scrapeAdapter';
import type { Chapter, Manga, ReadStatus, LibraryEntry } from '~/domain/types';
import { useAuth } from '~/lib/auth-context';

const NOISE_PATTERNS = [/\/jp\.png/, /\/kr\.png/, /\/cn\.png/, /\/logo/, /\/icon/];
const COVER_FALLBACK = 'https://placehold.co/400x600/1a1a1a/cccccc?text=No+Cover';

async function validateCoverUrl(url: string): Promise<string> {
  if (!url) return COVER_FALLBACK;
  if (NOISE_PATTERNS.some((p) => p.test(url))) return COVER_FALLBACK;

  try {
    let origin = '';
    try {
      origin = new URL(url).origin + '/';
    } catch {
      return COVER_FALLBACK;
    }

    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(origin)}`;
    const res = await fetch(proxyUrl, { method: 'HEAD' });
    if (!res.ok) return COVER_FALLBACK;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return COVER_FALLBACK;

    return url;
  } catch {
    return COVER_FALLBACK;
  }
}

export function useMangaDetailsViewModel(id: string) {
  const { uid } = useAuth();
  const [manga, setManga] = useState<Manga | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [inLib, setInLib] = useState(false);
  const [loading, setLoading] = useState(true);
  const [readerUrl, setReaderUrl] = useState<string | null>(null);
  const [loadingChapterId, setLoadingChapterId] = useState<string | null>(null);
  const setReaderOpen = useReaderStore((state) => state.setReaderOpen);

  const libraryEntry = useFirestoreCollection<LibraryEntry>(uid, 'libraryEntries');
  const currentLibraryEntry = useMemo(() => {
    if (!libraryEntry) return undefined;
    return libraryEntry.find((e) => e.mangaId === id);
  }, [libraryEntry, id]);

  const openReader = useCallback((chapterId: string) => {
    setReaderUrl(`/reader/${encodeURIComponent(chapterId)}?manga=${encodeURIComponent(id)}`);
    setReaderOpen(true);
  }, [id, setReaderOpen]);

  const closeReader = useCallback(() => {
    setReaderUrl(null);
    setReaderOpen(false);
  }, [setReaderOpen]);

  useEffect(() => {
    const parts = id.split(':');
    // Manga ID format: "{sourceId}:{slug}" or "{sourceId}:{id}"
    // For scrape sources: "scrape:preset-name:slug" or "preset-name:slug" (legacy)
    let sourceId: string;
    let mangaId: string;
    if (parts[0] === 'scrape') {
      sourceId = `${parts[0]}:${parts[1]}`;
      mangaId = parts.slice(2).join(':');
    } else if (parts[0].startsWith('preset-')) {
      // Legacy format without scrape: prefix
      sourceId = `scrape:${parts[0]}`;
      mangaId = parts.slice(1).join(':');
    } else {
      sourceId = parts[0];
      mangaId = parts.slice(1).join(':');
    }

    const load = async () => {
      setLoading(true);
      try {
        const provider = sourceGateway.getProvider(sourceId);
        if (!provider) {
          setManga(null);
          setChapters([]);
          setInLib(false);
          return;
        }

        if (!uid) {
          setManga(null);
          setChapters([]);
          setInLib(false);
          return;
        }

        const dbMangaSnap = await getDoc(doc(firestore, 'users', uid, 'manga', id));
        const dbChaptersSnap = await getDocs(
          query(collection(firestore, 'users', uid, 'chapters'), where('mangaId', '==', id))
        );
        const dbManga = dbMangaSnap.exists() ? (dbMangaSnap.data() as Manga) : null;
        const dbChapters = dbChaptersSnap.docs.map((d) => d.data() as Chapter);
        const inLibrary = await isInLibrary(uid, id);

        if (provider instanceof ScrapeAdapter) {
          if (dbManga) {
            setManga(dbManga);
            setChapters(dbChapters.sort((a, b) => b.chapterNumber - a.chapterNumber));
            setInLib(inLibrary);
            return;
          }

          const session = getScrapeSession(sourceId);
          if (!session) {
            setManga(null);
            setChapters([]);
            setInLib(false);
            return;
          }

          const validatedCoverUrl = await validateCoverUrl(session.mangaCoverUrl);
          setManga({
            id,
            sourceId,
            title: session.mangaTitle,
            coverUrl: validatedCoverUrl,
            author: '',
            artist: '',
            status: 'unknown',
            description: '',
            genres: [],
            tags: [],
            url: session.sourceUrl,
          });
          setChapters(
            session.chapters
              .sort((a, b) => b.chapterNumber - a.chapterNumber)
              .map((ch) => ({
                id: ch.id,
                mangaId: id,
                chapterNumber: ch.chapterNumber,
                title: ch.title,
                scanlator: '',
                releaseDate: '',
                pageCount: 0,
                read: false,
                lastReadPage: 0,
                url: session.chapterUrls[ch.id] || '',
                status: 'unread' as const,
              }))
          );
          setInLib(false);
          return;
        }

        if (!mangaId) {
          setManga(null);
          setChapters([]);
          setInLib(false);
          return;
        }

        const [m, c, l] = await Promise.all([
          provider.getMangaDetails(mangaId),
          provider.getChapters(mangaId),
          isInLibrary(uid, id),
        ]);

        const localChaptersSnap = await getDocs(
          query(collection(firestore, 'users', uid, 'chapters'), where('mangaId', '==', id))
        );
        const localChapters = localChaptersSnap.docs.map((d) => d.data() as Chapter);
        const localMap = new Map(localChapters.map((chapter) => [chapter.id, chapter]));

        setManga({ ...m, id, sourceId });
        setChapters(
          c
            .sort((a, b) => b.chapterNumber - a.chapterNumber)
            .map((chapter) => {
              const local = localMap.get(chapter.id);
              return {
                ...chapter,
                mangaId: id,
                status: local?.status || 'unread',
                read: local?.read || false,
                lastReadPage: local?.lastReadPage || 0,
                viewedAt: local?.viewedAt,
                completedAt: local?.completedAt,
              };
            })
        );
        setInLib(l);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id, uid]);

  const handleToggleLibrary = useCallback(async () => {
    if (!manga) return;
    if (!uid) return;
    const next = await toggleInLibrary(uid, manga, chapters);
    setInLib(next);
  }, [manga, chapters, uid]);

  const toggleChapterStatus = useCallback(
    async (chapterId: string, nextStatus: ReadStatus) => {
      if (!manga) return;
      setLoadingChapterId(chapterId);
      if (!uid) return;
      await statusService.markChapterStatus(uid, chapterId, id, nextStatus, 0);
      const updatedSnap = await getDoc(doc(firestore, 'users', uid, 'chapters', chapterId));
      const updated = updatedSnap.exists() ? (updatedSnap.data() as Chapter) : null;
      if (updated) {
        setChapters((prev) =>
          prev.map((chapter) => (chapter.id === chapterId ? (updated as Chapter) : chapter))
        );
      }
      setLoadingChapterId(null);
    },
    [id, manga, uid]
  );

  const readCounts = useMemo(() => {
    const viewed = chapters.filter((chapter) => chapter.status !== 'unread').length;
    const completed = chapters.filter((chapter) => chapter.status === 'completed').length;
    return { viewed, completed, total: chapters.length };
  }, [chapters]);

  const lastViewedChapter = useMemo(() => {
    if (!currentLibraryEntry?.lastViewedChapterId) return null;
    return chapters.find((chapter) => chapter.id === currentLibraryEntry.lastViewedChapterId) ?? null;
  }, [chapters, currentLibraryEntry]);

  return {
    manga,
    chapters,
    inLib,
    loading,
    readerUrl,
    loadingChapterId,
    libraryEntry: currentLibraryEntry,
    readCounts,
    lastViewedChapter,
    openReader,
    closeReader,
    handleToggleLibrary,
    toggleChapterStatus,
  };
}
