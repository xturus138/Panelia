import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFirestoreCollection } from '~/hooks/useFirestoreQuery';
import { getDoc, doc, collection, getDocs, query, where } from '~/infrastructure/db/db-gateway';
import { db as firestore } from '~/lib/firebase';
import { isInLibrary, toggleInLibrary } from '~/infrastructure/db/library';
import { sourceRegistry } from '~/infrastructure/sources';
import { statusService } from '~/infrastructure/services';
import { useReaderStore } from '~/presentation/stores';
import { setScrapeSession } from '~/services/scrape/sessionStore';
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
    const isScrape = parts[0] === 'scrape';
    const sourceId = isScrape ? `${parts[0]}:${parts[1]}` : parts[0];

    const load = async () => {
      setLoading(true);
      try {
        if (sourceId.startsWith('scrape')) {
          if (!uid) {
            setManga(null);
            setChapters([]);
            setInLib(false);
            return;
          }
          const dbMangaSnap = await getDoc(doc(firestore, 'users', uid, 'manga', id));
          const chaptersSnap = await getDocs(query(collection(firestore, 'users', uid, 'chapters'), where('mangaId', '==', id)));
          const dbManga = dbMangaSnap.exists() ? dbMangaSnap.data() as Manga : null;
          const dbChapters = chaptersSnap.docs.map((d) => d.data() as Chapter);
          const inLibrary = await isInLibrary(uid, id);

          if (dbManga) {
            setManga(dbManga as Manga);
            setChapters(dbChapters.sort((a, b) => b.chapterNumber - a.chapterNumber));
            setInLib(inLibrary);
            return;
          }

          const scrapeKey = parts[1];
          let adapter: ScrapeAdapter | null = null;
          let baseUrl = '';

          const provider = sourceRegistry.getOrRehydrate(sourceId);
          if (provider instanceof ScrapeAdapter) {
            adapter = provider;
            baseUrl = adapter['sourceUrl'];
          } else {
            const savedSourceSnap = await getDoc(doc(firestore, 'users', uid, 'scrapeSources', scrapeKey));
            if (savedSourceSnap.exists()) {
              const savedSource = savedSourceSnap.data() as any;
              sourceRegistry.registerScrapeSource(savedSource.id, savedSource.config, savedSource.baseUrl);
              const reg = sourceRegistry.get(sourceId);
              if (reg instanceof ScrapeAdapter) {
                adapter = reg;
                baseUrl = savedSource.baseUrl;
              }
            }
          }

          if (!adapter) {
            const { getPreset } = await import('~/services/scrape/presets');
            const preset = getPreset(scrapeKey.replace('preset-', ''));
            if (preset) {
              adapter = new ScrapeAdapter(scrapeKey, preset.config, preset.baseUrl);
              baseUrl = preset.baseUrl;
            }
          }
          if (!adapter) throw new Error('Tidak dapat menemukan konfigurasi sumber manga');

          const mangaUrlSlug = parts.slice(2).join(':');
          if (!mangaUrlSlug) throw new Error('ID manga tidak lengkap');

          const liveUrl = `${baseUrl.replace(/\/+$/, '')}/manga/${mangaUrlSlug}/`;
          const res = await fetch(`/api/proxy?url=${encodeURIComponent(liveUrl)}`);
          if (!res.ok) throw new Error(`Gagal mengambil manga: HTTP ${res.status}`);
          const html = await res.text();

          const processedHtml = html
            .replace(/<head>/i, `<head><base href="${liveUrl}" />`)
            .replace(/\sdata-(?:src|lazy-src|original)\s*=\s*(['"])(.*?)\1/gi,
              (_, quote: string, val: string) => ` src=${quote}${val}${quote} data-processed="true"`);

          const parsed = adapter.parseMangaPage(processedHtml);
          const validatedCover = parsed.coverUrl ? await validateCoverUrl(parsed.coverUrl) : '';

          const chapterUrls: Record<string, string> = {};
          for (const ch of parsed.chapters) {
            chapterUrls[ch.id] = ch.url;
          }
          setScrapeSession(
            scrapeKey,
            adapter.config,
            baseUrl,
            chapterUrls,
            parsed.id,
            parsed.title,
            validatedCover,
            liveUrl,
            parsed.chapters.map((ch) => ({ id: ch.id, title: ch.title, chapterNumber: ch.chapterNumber }))
          );

          const mangaFromParse: Manga = {
            id: parsed.id,
            sourceId: 'scrape',
            title: parsed.title,
            coverUrl: validatedCover,
            author: parsed.author,
            artist: parsed.artist,
            status: parsed.status,
            description: parsed.description,
            genres: parsed.genres,
            tags: parsed.tags,
            url: liveUrl,
          };
          setManga(mangaFromParse);
          setChapters(
            parsed.chapters
              .sort((a, b) => b.chapterNumber - a.chapterNumber)
              .map((ch) => ({
                id: ch.id,
                mangaId: parsed.id,
                chapterNumber: ch.chapterNumber,
                title: ch.title,
                scanlator: ch.scanlator || '',
                releaseDate: ch.releaseDate || '',
                pageCount: ch.pageCount || 0,
                read: false,
                lastReadPage: 0,
                url: ch.url,
                status: 'unread' as const,
              }))
          );
          setInLib(false);
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

        if (!uid) {
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

        const localChaptersSnap = await getDocs(query(collection(firestore, 'users', uid, 'chapters'), where('mangaId', '==', id)));
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
            }),
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
  }, [manga, chapters]);

  const toggleChapterStatus = useCallback(async (chapterId: string, nextStatus: ReadStatus) => {
    if (!manga) return;
    setLoadingChapterId(chapterId);
    if (!uid) return;
    await statusService.markChapterStatus(uid, chapterId, id, nextStatus, 0);
    const updatedSnap = await getDoc(doc(firestore, 'users', uid, 'chapters', chapterId));
    const updated = updatedSnap.exists() ? updatedSnap.data() as Chapter : null;
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
