import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '~/db/db';
import { isInLibrary, toggleInLibrary } from '~/db/library';
import { sourceRegistry } from '~/infrastructure/sources';
import { statusService } from '~/infrastructure/services';
import { useReaderStore } from '~/presentation/stores';
import { setScrapeSession } from '~/services/scrape/sessionStore';
import { ScrapeAdapter } from '~/services/scrape/scrapeAdapter';
import type { Chapter, Manga, ReadStatus } from '~/domain/types';

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
          // 1. Try DB first (saved library manga)
          const [dbManga, dbChapters, inLibrary] = await Promise.all([
            db.manga.get(id),
            db.chapters.where('mangaId').equals(id).toArray(),
            isInLibrary(id),
          ]);

          if (dbManga) {
            setManga(dbManga as Manga);
            setChapters((dbChapters as Chapter[]).sort((a, b) => b.chapterNumber - a.chapterNumber));
            setInLib(inLibrary);
            return;
          }

          // 2. DB miss — live scrape from source
          const scrapeKey = parts[1]; // e.g. "preset-komiku"
          let adapter: ScrapeAdapter | null = null;
          let baseUrl = '';
          let liveUrl = '';

          // Resolve adapter from sourceRegistry or DB storage
          const provider = sourceRegistry.getOrRehydrate(sourceId);
          if (provider instanceof ScrapeAdapter) {
            adapter = provider;
            baseUrl = adapter['sourceUrl']; // hacky — expose properly later
          } else {
            const savedSource = await db.scrapeSources.get(scrapeKey);
            if (savedSource) {
              sourceRegistry.registerScrapeSource(savedSource.id, savedSource.config, savedSource.baseUrl);
              const reg = sourceRegistry.get(sourceId);
              if (reg instanceof ScrapeAdapter) {
                adapter = reg;
                baseUrl = savedSource.baseUrl;
              }
            }
          }

          if (!adapter) {
            // Try to reconstruct from builtin preset
            const { getPreset } = await import('~/services/scrape/presets');
            const preset = getPreset(scrapeKey.replace('preset-', ''));
            if (preset) {
              adapter = new ScrapeAdapter(scrapeKey, preset.config, preset.baseUrl);
              baseUrl = preset.baseUrl;
            }
          }
          if (!adapter) throw new Error('Tidak dapat menemukan konfigurasi sumber manga');

          // Build manga URL from id (last part after the scrape: prefix parts)
          // id format: scrape:preset-komiku:604cmo
          const mangaUrlSlug = parts.slice(2).join(':');
          if (!mangaUrlSlug) throw new Error('ID manga tidak lengkap');

          liveUrl = `${baseUrl.replace(/\/+$/, '')}/manga/${mangaUrlSlug}/`;

          // 3. Fetch manga page HTML via proxy
          const res = await fetch(`/api/proxy?url=${encodeURIComponent(liveUrl)}`);
          if (!res.ok) throw new Error(`Gagal mengambil manga: HTTP ${res.status}`);
          const html = await res.text();

          // 4. Preprocess HTML (same pattern as BrowsePage)
          const processedHtml = html
            .replace(/<head>/i, `<head><base href="${liveUrl}" />`)
            .replace(/\sdata-(?:src|lazy-src|original)\s*=\s*(['"])(.*?)\1/gi,
              (_, quote: string, val: string) => ` src=${quote}${val}${quote} data-processed="true"`);

          // 5. Parse
          const parsed = adapter.parseMangaPage(processedHtml);

          // 6. Validate cover URL
          const validatedCover = parsed.coverUrl ? await validateCoverUrl(parsed.coverUrl) : '';

          // 7. Register live session so reader can resolve chapter URLs
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

          // 8. Set state with parsed data
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