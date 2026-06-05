import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '~/db/db';
import { isInLibrary, toggleInLibrary } from '~/db/library';
import { sourceRegistry } from '~/infrastructure/sources';
import { statusService } from '~/infrastructure/services';
import { useReaderStore } from '~/presentation/stores';
import type { Chapter, Manga, ReadStatus } from '~/domain/types';

export function useMangaDetailsViewModel(id: string) {
  const [manga, setManga] = useState<Manga | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [inLib, setInLib] = useState(false);
  const [loading, setLoading] = useState(true);
  const [readerUrl, setReaderUrl] = useState<string | null>(null);
  const [loadingChapterId, setLoadingChapterId] = useState<string | null>(null);
  const setReaderOpen = useReaderStore((state) => state.setReaderOpen);

  const libraryEntry = useLiveQuery(() => (id ? db.libraryEntries.get(id) : undefined), [id]);

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
    const isScrape = parts[0] === 'scrape';
    const sourceId = isScrape ? `${parts[0]}:${parts[1]}` : parts[0];

    const load = async () => {
      setLoading(true);
      try {
        if (sourceId.startsWith('scrape')) {
          const [m, c, l] = await Promise.all([
            db.manga.get(id),
            db.chapters.where('mangaId').equals(id).toArray(),
            isInLibrary(id),
          ]);
          setManga((m as Manga) ?? null);
          setChapters((c as Chapter[]).sort((a, b) => b.chapterNumber - a.chapterNumber));
          setInLib(l);
          return;
        }

        const mangaId = parts.slice(1).join(':');
        const provider = sourceRegistry.getOrRehydrate(sourceId);
        if (!provider || !mangaId) {
          setManga(null);
          setChapters([]);
          setInLib(false);
          return;
        }

        const [m, c, l, localChapters] = await Promise.all([
          provider.getMangaDetails(mangaId),
          provider.getChapters(mangaId),
          isInLibrary(id),
          db.chapters.where('mangaId').equals(id).toArray(),
        ]);

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
            }),
        );
        setInLib(l);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id]);

  const handleToggleLibrary = useCallback(async () => {
    if (!manga) return;
    const next = await toggleInLibrary(manga, chapters);
    setInLib(next);
  }, [manga, chapters]);

  const toggleChapterStatus = useCallback(async (chapterId: string, nextStatus: ReadStatus) => {
    if (!manga) return;
    setLoadingChapterId(chapterId);
    await statusService.markChapterStatus(chapterId, id, nextStatus, 0);
    const updated = await db.chapters.get(chapterId);
    if (updated) {
      setChapters((prev) => prev.map((chapter) => (chapter.id === chapterId ? (updated as Chapter) : chapter)));
    }
    setLoadingChapterId(null);
  }, [id, manga]);

  const readCounts = useMemo(() => {
    const viewed = chapters.filter((chapter) => chapter.status !== 'unread').length;
    const completed = chapters.filter((chapter) => chapter.status === 'completed').length;
    return { viewed, completed, total: chapters.length };
  }, [chapters]);

  const lastViewedChapter = useMemo(() => {
    if (!libraryEntry?.lastViewedChapterId) return null;
    return chapters.find((chapter) => chapter.id === libraryEntry.lastViewedChapterId) ?? null;
  }, [chapters, libraryEntry]);

  return {
    manga,
    chapters,
    inLib,
    loading,
    readerUrl,
    loadingChapterId,
    libraryEntry,
    readCounts,
    lastViewedChapter,
    openReader,
    closeReader,
    handleToggleLibrary,
    toggleChapterStatus,
  };
}