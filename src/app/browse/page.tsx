"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  Wand2,
  Search as SearchIcon,
  BookOpen,
  Settings2,
  Library,
  Check,
} from "lucide-react";
import { ScrapeAdapter } from "~/services/scrape/scrapeAdapter";
import { autoDetectConfig } from "~/services/scrape/autoDetect";
import { getBuiltinPresets, presetToScrapeSource } from "~/services/scrape/presets";
import type { SiteConfig, ParsedMangaPage, SearchResult, ScrapeSource } from "~/services/scrape/types";

type ViewMode = "sources" | "search" | "detail";

export default function BrowsePage() {
  // Source state
  const [sources, setSources] = useState<ScrapeSource[]>([]);
  const [activeSource, setActiveSource] = useState<ScrapeSource | null>(null);
  const [view, setView] = useState<ViewMode>("sources");
  const [configJson, setConfigJson] = useState<string>("");
  const [showConfig, setShowConfig] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const configDirty = useRef(false);

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Detail state
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [mangaData, setMangaData] = useState<ParsedMangaPage | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savedInSession, setSavedInSession] = useState(false);

  // Load presets on mount
  useEffect(() => {
    const loaded = getBuiltinPresets().map(presetToScrapeSource);
    setSources(loaded);
  }, []);

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

  const NOISE_PATTERNS = [/\/jp\.png/, /\/kr\.png/, /\/cn\.png/, /\/logo/, /\/icon/];

  async function validateCoverUrl(url: string): Promise<string> {
    const FALLBACK = "https://placehold.co/400x600/1a1a1a/cccccc?text=No+Cover";

    if (!url) return FALLBACK;

    // Check noise patterns
    if (NOISE_PATTERNS.some((p) => p.test(url))) return FALLBACK;

    try {
      const res = await fetch(url, { method: "HEAD" });
      if (!res.ok) return FALLBACK;

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.startsWith("image/")) return FALLBACK;

      return url;
    } catch {
      return FALLBACK;
    }
  }

  // ----- Search -----
  const handleSearch = useCallback(async () => {
    if (!activeSource || !query.trim()) return;
    setSearchLoading(true);
    setSaveStatus(null);
    try {
      const adapter = getAdapter(activeSource.baseUrl);
      const searchResults = await adapter.searchManga(query.trim());
      setResults(searchResults);
      setView("search");
      if (searchResults.length === 0) {
        setSaveStatus("No results found");
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch (err) {
      setSaveStatus(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setSaveStatus(null), 5000);
    }
    setSearchLoading(false);
  }, [activeSource, query, getAdapter]);

  // ----- Select manga → fetch detail page -----
  const handleSelectResult = useCallback(
    async (result: SearchResult) => {
      if (!activeSource) return;
      setDetailLoading(true);
      setSaveStatus(null);
      setSavedInSession(false);
      setCurrentUrl(result.url);
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

        setMangaData(parsed);
        setView("detail");
      } catch (err) {
        setSaveStatus(`Failed to load: ${err instanceof Error ? err.message : String(err)}`);
        setTimeout(() => setSaveStatus(null), 5000);
      }
      setDetailLoading(false);
    },
    [activeSource, getAdapter]
  );

  // ----- Save to library -----
  const handleSave = useCallback(async () => {
    if (!activeSource || !mangaData || !currentUrl) return;
    setSaveStatus(null);
    try {
      let config: SiteConfig;
      try {
        config = JSON.parse(configJson);
      } catch {
        setSaveStatus("Invalid config JSON");
        setTimeout(() => setSaveStatus(null), 3000);
        return;
      }

      const { db } = await import("~/db/db");
      const { sourceRegistry } = await import("~/services/sources");

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
      setSaveStatus(`Saved "${mangaData.title}" with ${chapterRows.length} chapters!`);
    } catch (err) {
      setSaveStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setTimeout(() => setSaveStatus(null), 5000);
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

      {/* Status bar */}
      {saveStatus && (
        <div
          className={`px-4 py-2 text-sm border-b ${
            saveStatus.startsWith("Failed") || saveStatus.startsWith("Search failed")
              ? "bg-destructive/10 border-destructive/20 text-destructive"
              : "bg-primary/10 border-primary/20 text-primary"
          }`}
        >
          {saveStatus}
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
                    <div className="aspect-[3/4] bg-muted relative overflow-hidden">
                      {r.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.coverUrl}
                          alt={r.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <BookOpen className="w-8 h-8 opacity-30" />
                        </div>
                      )}
                    </div>
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mangaData.coverUrl}
                    alt={mangaData.title}
                    className="w-28 h-40 rounded-xl object-cover shadow-lg flex-shrink-0 bg-muted"
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
                      <Link
                        key={ch.id}
                        href={`/reader/${ch.id}?manga=${mangaData.id}`}
                        className="block bg-card rounded-lg px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <span className="font-medium">
                          Chapter {ch.chapterNumber}
                          {ch.title ? `: ${ch.title}` : ""}
                        </span>
                      </Link>
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
    </div>
  );
}
