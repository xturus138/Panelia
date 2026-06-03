"use client";

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Page, Chapter } from '~/types';
import { sourceRegistry } from '~/services/sources';
import { db } from '~/db/db';

// Generate placeholder pages for testing reader
function generatePlaceholderPages(count: number): Page[] {
  return Array.from({ length: count }).map((_, i) => ({
    index: i,
    imageUrl: `https://placehold.co/800x1200/1a1a1a/cccccc?text=Page+${i + 1}`,
  }));
}

export default function ReaderPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = use(params);
  const router = useRouter();

  const [pages, setPages] = useState<Page[]>([]);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chapterId) return;

    // Handle scrape chapters: format is "scrape:{sourceId}:ch:{hash}"
    if (chapterId.startsWith('scrape:')) {
      loadScrapeChapter(chapterId);
    } else {
      // Keep existing placeholder behavior for non-scrape chapters
      setLoading(true);
      setPages(generatePlaceholderPages(5));
      setLoading(false);
    }
  }, [chapterId]);

  async function loadScrapeChapter(chapterId: string) {
    setLoading(true);
    setError(null);
    try {
      // Parse chapterId: format is `scrape:{sourceId}:ch:{hash}`
      const parts = chapterId.split(':');
      if (parts.length < 4 || parts[0] !== 'scrape' || parts[2] !== 'ch') {
        throw new Error('Invalid scrape chapter ID format');
      }

      const sourceId = parts[1];
      const chapterHash = parts[3];

      // Fetch chapter record from db.chapters to get URL
      const chapter = await db.chapters.get(chapterId);
      if (!chapter) {
        throw new Error('Chapter not found in database');
      }

      const url = chapter.url;
      if (!url) {
        throw new Error('Chapter URL not found');
      }

      // Look up ScrapeAdapter via sourceRegistry.get("scrape:" + sourceId)
      const adapter = sourceRegistry.get(`scrape:${sourceId}`);
      if (!adapter) {
        throw new Error(`Scrape adapter not found for source: ${sourceId}`);
      }

      // Fetch HTML via /api/proxy?url=...
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch chapter: ${response.status}`);
      }
      const html = await response.text();

      // Call adapter.parseChapterPage(html)
      // Note: The adapter is retrieved from sourceRegistry.get() which returns SourceProvider | null.
      // We need to cast it to access parseChapterPage since that's a ScrapeAdapter-specific method.
      const scrapedPages = (adapter as any).parseChapterPage(html);

      // Convert to Page type
      const pages: Page[] = scrapedPages.map((p: any) => ({
        index: p.index,
        imageUrl: p.imageUrl,
      }));

      setPages(pages);
    } catch (err) {
      console.error('Error loading scrape chapter:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPages([]); // Clear pages on error
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col overflow-y-auto">
      {/* Pages Container - Vertical Scroll Mode for MVP */}
      <div
        className="flex-1 w-full max-w-3xl mx-auto flex flex-col"
        onClick={() => setControlsVisible(!controlsVisible)}
      >
        {loading && !pages.length && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        )}
        {error && !pages.length && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-destructive">{error}</p>
          </div>
        )}
        {pages.length > 0 && (
          <>
            {pages.map((page) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={page.index}
                src={page.imageUrl}
                alt={`Page ${page.index + 1}`}
                className="w-full object-contain"
                loading="lazy"
              />
            ))}
          </>
        )}
      </div>

      {/* Overlay Controls */}
      {controlsVisible && (
        <>
          {/* Header */}
          <div className="fixed top-0 left-0 right-0 bg-black/80 text-white p-4 flex items-center">
            <button onClick={() => router.back()} className="mr-4">← Back</button>
            <span className="truncate">Chapter Viewer</span>
          </div>

          {/* Footer */}
          <div className="fixed bottom-0 left-0 right-0 bg-black/80 text-white p-4">
             <div className="text-center text-sm">{pages.length} Pages</div>
          </div>
        </>
      )}
    </div>
  );
}