"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  Wand2,
  Search as SearchIcon,
  BookOpen,
  Settings2,
  Check,
} from "lucide-react";
import { MangaCover } from "~/components/common/MangaCover";
import { ScrapeAdapter } from "~/services/scrape/scrapeAdapter";
import { useReaderStore } from "~/presentation/stores";
import { autoDetectConfig } from "~/services/scrape/autoDetect";
import { getBuiltinPresets, presetToScrapeSource } from "~/services/scrape/presets";
import { setScrapeSession } from "~/services/scrape/sessionStore";
import type { SiteConfig, ParsedMangaPage, SearchResult, ScrapeSource } from "~/services/scrape/types";
import { useToast } from "~/hooks/useToast";

type ViewMode = "sources" | "search" | "detail";

const NOISE_PATTERNS = [/\/jp\.png/, /\/kr\.png/, /\/cn\.png/, /\/logo/, /\/icon/];
const COVER_FALLBACK = "https://placehold.co/400x600/1a1a1a/cccccc?text=No+Cover";

async function validateCoverUrl(url: string): Promise<string> {
  if (!url) return COVER_FALLBACK;
  if (NOISE_PATTERNS.some((p) => p.test(url))) return COVER_FALLBACK;

  // Route the validation through the local proxy to avoid CORS issues
  // and spoof the Referer header that some manga sites require.
  try {
    let origin = "";
    try {
      origin = new URL(url).origin + "/";
    } catch {
      // invalid url
      return COVER_FALLBACK;
    }

    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(origin)}`;
    const res = await fetch(proxyUrl, { method: "HEAD" });
    if (!res.ok) return COVER_FALLBACK;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return COVER_FALLBACK;

    return url;
  } catch {
    return COVER_FALLBACK;
  }
}

export default function BrowsePage() {
  // Source state
  const [sources, setSources] = useState<ScrapeSource[]>([]);
  const [activeSource, setActiveSource] = useState<ScrapeSource | null>(null);
  const [view, setView] = useState<ViewMode>("sources");
  const [configJson, setConfigJson] = useState<string>("");
  const [showConfig, setShowConfig] = useState(false);
  const configDirty = useRef(false);
  const toast = useToast();

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Detail state
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [mangaData, setMangaData] = useState<ParsedMangaPage | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savedInSession, setSavedInSession] = useState(false);
  const [readerUrl, setReaderUrl] = useState<string | null>(null);
  const setReaderOpen = useReaderStore((s) => s.setReaderOpen);
  const closeReader = useCallback(() => {
    setReaderUrl(null);
    setReaderOpen(false);
  }, [setReaderOpen]);

  // Load presets on mount
  useEffect(() => {
    const loaded = getBuiltinPresets().map(presetToScrapeSource);
    setSources(loaded);
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'panelia:close-reader') {
        closeReader();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [closeReader]);

  useEffect(() => {
    if (!readerUrl) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [readerUrl]);

  const openReader = useCallback((chapterId: string, mangaId: string) => {
    setReaderUrl(`/reader/${encodeURIComponent(chapterId)}?manga=${encodeURIComponent(mangaId)}`);
    setReaderOpen(true);
  }, [setReaderOpen]);

  const handleReaderBackdrop = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      closeReader();
    }
  }, [closeReader]);

  const handleReaderFrameClick = useCallback((e: React.MouseEvent<HTMLIFrameElement>) => {
    e.stopPropagation();
  }, []);

  const handleReaderEscape = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      closeReader();
    }
  }, [closeReader]);

  const handleReaderClose = useCallback(() => {
    closeReader();
  }, [closeReader]);

  const readerTitle = mangaData?.title ? `Reader ${mangaData.title}` : 'Reader';

  // When source changes, reset view and set default config
  useEffect(() => {
    if (!activeSource) {
      setView("sources");
      return;
    }
    setView("search");
    setResults([]);
    setMangaData(null);
    setQuery("");
    setConfigJson(JSON.stringify(activeSource.config, null, 2));
    configDirty.current = false;
    setSavedInSession(false);

    // Auto-load popular manga when source is selected
    const autoLoad = async () => {
      setSearchLoading(true);
      const loading = toast.loading(`Loading popular from ${activeSource.name}...`);
      try {
        const adapter = new ScrapeAdapter(activeSource.id, activeSource.config, activeSource.baseUrl);
        // Try popularPage first, fallback to empty search
        const popularResults = await adapter.getPopularResults();
        // Dedupe by URL since the same manga can appear in multiple sections
        const seen = new Set<string>();
        const deduped = popularResults.filter((r) => {
          if (seen.has(r.url)) return false;
          seen.add(r.url);
          return true;
        });
        setResults(deduped);
        loading.dismiss();
      } catch (err) {
        console.error("Auto-load failed:", err);
        loading.dismiss();
        toast.error(`Auto-load failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      setSearchLoading(false);
    };
    autoLoad();
  }, [activeSource]);

  // Build adapter from current config and URL
  const getAdapter = useCallback(
    (url: string): ScrapeAdapter => {
      if (!activeSource) throw new Error("No source selected");
      let config: SiteConfig;
      try {
        config = JSON.parse(configJson);
      } catch {
        throw new Error("Invalid config JSON");
      }
      return new ScrapeAdapter(activeSource.id, config, url);
    },
    [activeSource, configJson]
  );

  // ----- Search -----
  const handleSearch = useCallback(async () => {
    if (!activeSource || !query.trim()) return;
    setSearchLoading(true);
    const loading = toast.loading("Searching...");
    try {
      const adapter = getAdapter(activeSource.baseUrl);
      const searchResults = await adapter.searchManga(query.trim());
      // Dedupe by URL
      const seen = new Set<string>();
      const deduped = searchResults.filter((r) => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      });
      setResults(deduped);
      setView("search");
      loading.dismiss();
      if (deduped.length === 0) {
        toast.error("No results found", 3000);
      }
    } catch (err) {
      loading.dismiss();
      toast.error(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setSearchLoading(false);
  }, [activeSource, query, getAdapter]);

  // ----- Select manga → fetch detail page -----
  const handleSelectResult = useCallback(
    async (result: SearchResult) => {
      if (!activeSource) return;
      setDetailLoading(true);
      setSavedInSession(false);
      setCurrentUrl(result.url);
      const loading = toast.loading("Loading manga details...");
      try {
        const res = await fetch(`/api/proxy?url=${encodeURIComponent(result.url)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        const adapter = getAdapter(result.url);

        // Preprocess HTML for extraction (same base + lazy-load fixes)
        const processedHtml = html
          .replace(/<head>/i, `<head><base href="${result.url}" />`)
          .replace(/\sdata-(?:src|lazy-src|original)\s*=\s*(['"])(.*?)\1/gi, (_, quote, val) => ` src=${quote}${val}${quote} data-processed="true"`);

        const parsed = adapter.parseMangaPage(processedHtml);

        // Validate cover URL
        parsed.coverUrl = await validateCoverUrl(parsed.coverUrl);

        // Register a live-read session so the reader can resolve chapter URLs
        // and rebuild the adapter on-the-fly without saving to the library.
        const chapterUrls: Record<string, string> = {};
        for (const ch of parsed.chapters) {
          chapterUrls[ch.id] = ch.url;
        }
        let liveConfig: SiteConfig;
        try {
          liveConfig = JSON.parse(configJson);
        } catch {
          liveConfig = activeSource.config;
        }
        setScrapeSession(
          activeSource.id,
          liveConfig,
          activeSource.baseUrl,
          chapterUrls,
          parsed.id,
          parsed.title,
          parsed.coverUrl,
          result.url,
          parsed.chapters.map((ch) => ({ id: ch.id, title: ch.title, chapterNumber: ch.chapterNumber }))
        );

        setMangaData(parsed);
        setView("detail");
        loading.dismiss();
      } catch (err) {
        loading.dismiss();
        toast.error(`Failed to load: ${err instanceof Error ? err.message : String(err)}`);
      }
      setDetailLoading(false);
    },
    [activeSource, getAdapter, configJson]
  );

  // ----- Save to library -----
  const handleSave = useCallback(async () => {
    if (!activeSource || !mangaData || !currentUrl) return;
    const loading = toast.loading("Saving to library...");
    try {
      let config: SiteConfig;
      try {
        config = JSON.parse(configJson);
      } catch {
        loading.dismiss();
        toast.error("Invalid config JSON");
        return;
      }

      const { db } = await import("~/db/db");
      const { sourceRegistry } = await import("~/infrastructure/sources");

      // Save scrape source config
      await db.scrapeSources.put({
        id: activeSource.id,
        name: config.name || mangaData.title,
        baseUrl: config.baseUrl,
        config,
        createdAt: new Date().toISOString(),
      });

      // Save manga to DB
      const validatedCover = await validateCoverUrl(mangaData.coverUrl);
      mangaData.coverUrl = validatedCover; // keep in sync
      await db.manga.put({
        id: mangaData.id,
        sourceId: "scrape",
        title: mangaData.title,
        coverUrl: validatedCover,
        author: mangaData.author,
        artist: mangaData.artist,
        status: mangaData.status,
        description: mangaData.description,
        genres: mangaData.genres,
        tags: mangaData.tags,
        url: currentUrl,
      } as any);

      // Save chapters
      const chapterRows = mangaData.chapters.map((ch) => ({
        id: ch.id,
        mangaId: mangaData.id,
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        scanlator: ch.scanlator,
        releaseDate: ch.releaseDate,
        pageCount: ch.pageCount,
        read: false,
        lastReadPage: 0,
        url: ch.url,
        status: 'unread' as const,
      }));
      await db.chapters.bulkPut(chapterRows);

      // Add to library
      await db.libraryEntries.put({
        mangaId: mangaData.id,
        categories: [],
        dateAdded: new Date().toISOString(),
        unreadCount: chapterRows.length,
      });

      // Register with sourceRegistry
      sourceRegistry.registerScrapeSource(activeSource.id, config, currentUrl);

      setSavedInSession(true);
      loading.dismiss();
      toast.success(`Saved "${mangaData.title}" with ${chapterRows.length} chapters!`);
    } catch (err) {
      loading.dismiss();
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [activeSource, mangaData, currentUrl, configJson]);

  // ----- Re-detect config for current detail page -----
  const handleRedetect = useCallback(async () => {
    if (!currentUrl) return;
    try {
      const res = await fetch(`/api/proxy?url=${encodeURIComponent(currentUrl)}`);
      if (!res.ok) return;
      const html = await res.text();
      const config = autoDetectConfig(html, currentUrl);
      setConfigJson(JSON.stringify(config, null, 2));
      configDirty.current = false;
    } catch {}
  }, [currentUrl]);

  // ----- Render -----
  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Source Tabs */}
      <div className="flex items-center gap-2 px-3 pt-3 bg-secondary border-b border-border overflow-x-auto">
        <BookOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        {sources.map((src) => (
          <button
            key={src.id}
            onClick={() => setActiveSource(src)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeSource?.id === src.id
                ? "bg-background text-foreground border border-border border-b-background -mb-px"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {src.name}
          </button>
        ))}
        <button
          disabled
          className="px-3 py-2 rounded-t-lg text-xs text-muted-foreground/40 italic"
          title="More sources coming soon"
        >
          + Add source
        </button>
      </div>

      {/* Search Bar (only when source selected, not in detail view) */}
      {activeSource && view !== "detail" && (
        <div className="flex items-center gap-2 p-3 bg-secondary border-b border-border">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex-1 flex items-center gap-2"
          >
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${activeSource.name}...`}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              disabled={!query.trim() || searchLoading}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
            </button>
          </form>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`p-2.5 rounded-xl ${showConfig ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            title="Edit scrape config"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Config Panel */}
      {showConfig && (
        <div className="p-3 bg-card border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Site Config (JSON)</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRedetect}
                className="text-xs text-primary hover:underline flex items-center gap-1"
                type="button"
              >
                <Wand2 className="w-3 h-3" />
                Auto-detect
              </button>
              <button
                onClick={() => setShowConfig(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
                type="button"
              >
                Done
              </button>
            </div>
          </div>
          <textarea
            value={configJson}
            onChange={(e) => {
              setConfigJson(e.target.value);
              configDirty.current = true;
            }}
            placeholder='{"name":"...","baseUrl":"...","mangaPage":{...},"chapterPage":{...}}'
            className="w-full h-40 px-3 py-2 rounded-lg bg-background text-xs font-mono border border-border focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1">
            CSS selectors control how data is extracted. Edit and re-search or re-enter the detail page to apply changes.
          </p>
        </div>
      )}

      {/* ============ Main Content ============ */}
      <div className="flex-1 overflow-y-auto">
        {/* Sources landing */}
        {view === "sources" && (
          <div className="p-6 max-w-lg mx-auto pt-16">
            <h2 className="text-lg font-semibold mb-1">Browse Sources</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Pick a source to search for manga by name.
            </p>
            <div className="flex flex-col gap-3">
              {sources.map((src) => (
                <button
                  key={src.id}
                  onClick={() => setActiveSource(src)}
                  className="text-left p-4 rounded-xl bg-card border border-border hover:border-primary/40 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{src.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{src.baseUrl}</p>
                    </div>
                    <ArrowLeft className="w-5 h-5 text-muted-foreground rotate-180" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search results */}
        {view === "search" && (
          <div className="p-4">
            {searchLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {!searchLoading && results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <SearchIcon className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">
                  {query.trim() ? "No results found" : `Search for manga on ${activeSource?.name}`}
                </p>
              </div>
            )}

            {!searchLoading && results.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleSelectResult(r)}
                    className="group text-left bg-card rounded-xl border border-border overflow-hidden hover:border-primary/40 hover:shadow-md transition-all"
                  >
                    <MangaCover
                      src={r.coverUrl}
                      alt={r.title}
                      aspectRatio="3/4"
                      objectFit="cover"
                      loading="lazy"
                      className="group-hover:scale-105 transition-transform"
                    />
                    <div className="p-2">
                      <p className="text-xs font-medium text-foreground line-clamp-2 leading-relaxed">
                        {r.title}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Detail view */}
        {view === "detail" && (
          <div className="pb-24">
            {detailLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {!detailLoading && mangaData && (
              <>
                {/* Back + save */}
                <div className="sticky top-0 bg-background z-10 flex items-center gap-2 px-4 py-3 border-b border-border">
                  <button
                    onClick={() => setView("search")}
                    className="p-2 rounded-lg hover:bg-muted"
                    aria-label="Back to search"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-medium text-foreground flex-1 truncate">
                    {mangaData.title}
                  </span>
                  <button
                    onClick={handleSave}
                    disabled={savedInSession}
                    className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
                      savedInSession
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-primary text-primary-foreground hover:bg-primary/80"
                    }`}
                  >
                    {savedInSession ? (
                      <>
                        <Check className="w-4 h-4" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save to Library
                      </>
                    )}
                  </button>
                </div>

                {/* Cover + Info */}
                <div className="flex gap-4 p-4 border-b border-border">
                  <MangaCover
                    src={mangaData.coverUrl}
                    alt={mangaData.title}
                    aspectRatio="3/4"
                    objectFit="cover"
                    priority
                    className="w-28 h-40 rounded-xl shadow-lg flex-shrink-0"
                  />
                  <div className="flex flex-col justify-center min-w-0">
                    <h1 className="text-lg font-bold text-foreground leading-tight">
                      {mangaData.title}
                    </h1>
                    {mangaData.author && (
                      <p className="text-sm text-muted-foreground mt-1">{mangaData.author}</p>
                    )}
                    {mangaData.genres && mangaData.genres.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {mangaData.genres.slice(0, 4).map((g) => (
                          <span
                            key={g}
                            className="text-[10px] font-medium bg-secondary px-2 py-1 rounded-full"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                    {mangaData.description && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                        {mangaData.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Chapter list */}
                <div className="px-4 pt-4">
                  <h2 className="text-sm font-semibold text-foreground mb-3">
                    {mangaData.chapters.length} Chapters
                  </h2>
                  <div className="flex flex-col gap-1.5">
                    {mangaData.chapters.map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => openReader(ch.id, mangaData.id)}
                        className="block w-full text-left bg-card rounded-lg px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <span className="font-medium">
                          Chapter {ch.chapterNumber}
                          {ch.title ? `: ${ch.title}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!detailLoading && !mangaData && (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <AlertCircle className="w-5 h-5 mr-2" />
                <span className="text-sm">Could not load manga details</span>
              </div>
            )}
          </div>
        )}
      </div>

      {readerUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black"
          onClick={handleReaderBackdrop}
          onKeyDown={handleReaderEscape}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={readerTitle}
        >
          <div className="absolute inset-0 flex flex-col bg-black">
            <div className="flex items-center justify-between px-3 py-2.5 bg-black/85 text-white border-b border-white/10">
              <div className="min-w-0">
                <p className="text-[12px] text-white/60">Reader</p>
                <p className="text-[14px] font-medium truncate">{mangaData?.title || 'Manga'}</p>
              </div>
              <button
                type="button"
                onClick={handleReaderClose}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[12px]"
              >
                Close
              </button>
            </div>
            <iframe
              title={readerTitle}
              src={readerUrl}
              className="flex-1 w-full border-0"
              allow="fullscreen"
            />
          </div>
        </div>
      )}
    </div>
  );
}
