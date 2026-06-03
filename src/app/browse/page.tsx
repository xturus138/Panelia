"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { ArrowLeft, ArrowRight, RefreshCw, Home, Save, Loader2, AlertCircle } from "lucide-react";
import { ScrapeAdapter } from "~/services/scrape/scrapeAdapter";
import type { SiteConfig, ParsedMangaPage } from "~/services/scrape/types";

interface PageState {
  url: string;
  html: string;
  loading: boolean;
  error: string | null;
  history: string[];
  historyIndex: number;
}

const DEFAULT_URL = "https://example.com";

export default function BrowsePage() {
  const [state, setState] = useState<PageState>({
    url: DEFAULT_URL,
    html: "",
    loading: false,
    error: null,
    history: [DEFAULT_URL],
    historyIndex: 0,
  });

  const [urlInput, setUrlInput] = useState(DEFAULT_URL);
  const [configJson, setConfigJson] = useState<string>("");
  const [showConfig, setShowConfig] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fetchUrl = useCallback(async (url: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || err.detail || `HTTP ${res.status}`);
      }
      const html = await res.text();
      setState((prev) => ({
        ...prev,
        url,
        html,
        loading: false,
        error: null,
      }));
      setUrlInput(url);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  const navigate = useCallback((url: string) => {
    setState((prev) => {
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push(url);
      return {
        ...prev,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    });
    fetchUrl(url);
  }, [fetchUrl]);

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.historyIndex <= 0) return prev;
      const newIndex = prev.historyIndex - 1;
      const url = prev.history[newIndex];
      if (url !== prev.url) fetchUrl(url);
      return { ...prev, historyIndex: newIndex };
    });
  }, [fetchUrl]);

  const goForward = useCallback(() => {
    setState((prev) => {
      if (prev.historyIndex >= prev.history.length - 1) return prev;
      const newIndex = prev.historyIndex + 1;
      const url = prev.history[newIndex];
      if (url !== prev.url) fetchUrl(url);
      return { ...prev, historyIndex: newIndex };
    });
  }, [fetchUrl]);

  const refresh = useCallback(() => {
    fetchUrl(state.url);
  }, [fetchUrl, state.url]);

  const goHome = useCallback(() => {
    setState({
      url: DEFAULT_URL,
      html: "",
      loading: false,
      error: null,
      history: [DEFAULT_URL],
      historyIndex: 0,
    });
    setUrlInput(DEFAULT_URL);
  }, []);

  // Intercept link clicks in the iframe to navigate within Browse Mode
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !state.html) return;

    // srcdoc iframes are same-origin, so contentDocument is accessible
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;

      const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest("a");
        if (anchor && anchor.href && anchor.href !== "#") {
          e.preventDefault();
          e.stopPropagation();
          navigate(anchor.href);
        }
      };
      doc.addEventListener("click", handleClick);
      return () => doc.removeEventListener("click", handleClick);
    } catch {
      // Cross-origin - should not happen with srcdoc
    }
  }, [state.html, navigate]);

  const saveToLibrary = useCallback(async () => {
    if (!state.html || !state.url) {
      setSaveStatus("No page loaded");
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }
    if (!configJson) {
      setSaveStatus("Please provide a site config (click the gear icon)");
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }

    let config: SiteConfig;
    try {
      config = JSON.parse(configJson);
    } catch {
      setSaveStatus("Invalid config JSON - check formatting");
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }

    try {
      const sourceId = `user-${Date.now()}`;
      const adapter = new ScrapeAdapter(sourceId, config, state.url);
      const parsed: ParsedMangaPage = adapter.parseMangaPage(state.html);

      // Save scrape source config
      const { db } = await import("~/db/db");
      await db.scrapeSources.put({
        id: sourceId,
        name: config.name || parsed.title,
        baseUrl: config.baseUrl,
        config,
        createdAt: new Date().toISOString(),
      });

      // Save manga to DB
      await db.manga.put({
        id: parsed.id,
        sourceId: "scrape",
        title: parsed.title,
        coverUrl: parsed.coverUrl,
        author: parsed.author,
        artist: parsed.artist,
        status: parsed.status,
        description: parsed.description,
        genres: parsed.genres,
        tags: parsed.tags,
        url: state.url,
      } as any); // Manga type mismatch, cast acceptable

      // Save chapters
      const chapterRows = parsed.chapters.map((ch) => ({
        id: ch.id,
        mangaId: parsed.id,
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

      // Register with sourceRegistry
      const { sourceRegistry } = await import("~/services/sources");
      sourceRegistry.registerScrapeSource(sourceId, config, state.url);

      setSaveStatus(`Saved "${parsed.title}" with ${chapterRows.length} chapters!`);
    } catch (err) {
      setSaveStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setTimeout(() => setSaveStatus(null), 5000);
  }, [state.html, state.url, configJson]);

  // Default config based on current URL origin
  const loadExampleConfig = useCallback(() => {
    try {
      const origin = new URL(state.url).origin;
      setConfigJson(JSON.stringify({
        name: new URL(state.url).hostname,
        baseUrl: origin,
        mangaPage: {
          title: "h1",
          cover: "img",
          chapterList: "a",
          chapterTitle: "",
          chapterUrl: "",
        },
        chapterPage: { images: "img" },
      }, null, 2));
    } catch {
      setConfigJson(`{\n  "name": "Site",\n  "baseUrl": "",\n  "mangaPage": {},\n  "chapterPage": {}\n}`);
    }
  }, [state.url]);

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* URL Bar */}
      <div className="flex items-center gap-2 p-3 bg-secondary border-b border-border">
        <button
          onClick={goBack}
          disabled={state.historyIndex <= 0}
          className="p-2 rounded-lg hover:bg-secondary/80 disabled:opacity-30"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          onClick={goForward}
          disabled={state.historyIndex >= state.history.length - 1}
          className="p-2 rounded-lg hover:bg-secondary/80 disabled:opacity-30"
          aria-label="Forward"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={refresh}
          className="p-2 rounded-lg hover:bg-secondary/80"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${state.loading ? "animate-spin" : ""}`} />
        </button>
        <button
          onClick={goHome}
          className="p-2 rounded-lg hover:bg-secondary/80"
          aria-label="Home"
        >
          <Home className="w-4 h-4" />
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const url = urlInput.startsWith("http") ? urlInput : `https://${urlInput}`;
            setUrlInput(url);
            navigate(url);
          }}
          className="flex-1"
        >
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Enter URL..."
            className="w-full px-3 py-2 rounded-lg bg-background text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </form>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`p-2 rounded-lg ${showConfig ? "bg-primary text-primary-foreground" : "hover:bg-secondary/80"}`}
          aria-label="Toggle config"
          title="Site scraping config"
        >
          &#9881;&#65039;
        </button>
        <button
          onClick={saveToLibrary}
          disabled={!state.html}
          className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Save to library"
          title="Save to library"
        >
          <Save className="w-4 h-4" />
        </button>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div className="p-3 bg-card border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Site Config (JSON)</h3>
            <button
              onClick={loadExampleConfig}
              className="text-xs text-primary hover:underline"
              type="button"
            >
              Auto-generate
            </button>
          </div>
          <textarea
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            placeholder='{"name":"...","baseUrl":"...","mangaPage":{...},"chapterPage":{...}}'
            className="w-full h-48 px-3 py-2 rounded-lg bg-background text-xs font-mono border border-border focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          <p className="text-xs text-muted-foreground mt-2">
            CSS selectors tell the scraper how to extract manga data from this site.
            <button
              onClick={() => setShowConfig(false)}
              className="ml-2 text-primary hover:underline"
              type="button"
            >
              Done
            </button>
          </p>
        </div>
      )}

      {/* Save status */}
      {saveStatus && (
        <div className="p-3 bg-primary/10 border-b border-primary/20 text-sm text-primary">
          {saveStatus}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 relative overflow-hidden">
        {state.loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {state.error && !state.loading && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="max-w-md p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Failed to load</p>
                <p className="text-xs text-muted-foreground mt-1">{state.error}</p>
              </div>
            </div>
          </div>
        )}
        {state.html && !state.error && (
          <iframe
            ref={iframeRef}
            srcDoc={state.html}
            className="w-full h-full border-0 bg-white"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            title="Browse"
          />
        )}
        {!state.html && !state.loading && !state.error && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <p className="text-muted-foreground">Enter a URL above to start browsing</p>
          </div>
        )}
      </div>
    </div>
  );
}
