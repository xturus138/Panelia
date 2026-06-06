'use client';

import { useFirestoreCollection } from '~/hooks/useFirestoreQuery';
import { EmptyState } from '~/components/common/EmptyState';
import { Bell, RefreshCw, Loader2 } from 'lucide-react';
import { MangaCover } from '~/components/common/MangaCover';
import Link from 'next/link';
import { useCallback, useState, useMemo } from 'react';
import { syncChapters } from '~/db/sync';
import { useToast } from '~/hooks/useToast';
import type { LibraryEntry, Manga, Chapter } from '~/domain/types';

export default function UpdatesPage() {
  const toast = useToast();
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const [refreshAllLoading, setRefreshAllLoading] = useState(false);

  const libraryEntries = useFirestoreCollection<LibraryEntry>('libraryEntries');
  const allManga = useFirestoreCollection<Manga>('manga');
  const allChapters = useFirestoreCollection<Chapter>('chapters');

  const updates = useMemo(() => {
    if (!libraryEntries || !allManga || !allChapters) return undefined;

    const mangaMap = new Map(allManga.map((m) => [m.id, m]));

    const grouped: Record<string, Chapter[]> = {};
    for (const ch of allChapters) {
      if (ch.status !== 'unread') continue;
      if (!grouped[ch.mangaId]) grouped[ch.mangaId] = [];
      grouped[ch.mangaId].push(ch);
    }

    return Object.entries(grouped)
      .map(([mangaId, chapters]) => ({
        mangaId,
        manga: mangaMap.get(mangaId),
        newChapters: chapters.length,
        latestChapter: [...chapters].sort((a, b) => b.chapterNumber - a.chapterNumber)[0],
      }))
      .filter((u) => u.manga)
      .sort((a, b) => {
        const aDate = a.latestChapter?.viewedAt || '';
        const bDate = b.latestChapter?.viewedAt || '';
        return bDate.localeCompare(aDate);
      });
  }, [libraryEntries, allManga, allChapters]);

  const handleRefresh = useCallback(async (mangaId: string) => {
    setRefreshingIds((prev) => new Set(prev).add(mangaId));
    try {
      await syncChapters(mangaId);
    } catch (err) {
      console.error(`Failed to sync ${mangaId}:`, err);
    } finally {
      setRefreshingIds((prev) => {
        const next = new Set(prev);
        next.delete(mangaId);
        return next;
      });
    }
  }, []);

  const handleRefreshAll = useCallback(async () => {
    if (!libraryEntries || libraryEntries.length === 0) return;
    setRefreshAllLoading(true);
    const t = toast.loading('Refreshing all...');
    try {
      for (const entry of libraryEntries) {
        await handleRefresh(entry.mangaId);
      }
      t.dismiss();
      toast.success('All updated');
    } catch {
      t.dismiss();
      toast.error('Some updates failed');
    } finally {
      setRefreshAllLoading(false);
    }
  }, [libraryEntries, handleRefresh, toast]);

  if (updates === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-bold text-foreground leading-tight">Updates</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {updates.length === 0 ? 'No new chapters' : `${updates.length} manga with updates`}
          </p>
        </div>
        <button
          onClick={handleRefreshAll}
          disabled={refreshAllLoading}
          className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center disabled:opacity-50"
          title="Refresh All"
        >
          {refreshAllLoading ? (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {updates.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No updates"
          description="Add manga to your library to see new chapter updates here"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {updates.map((item) => (
            <div
              key={item.mangaId}
              className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex items-center gap-3 hover:bg-muted/30 transition-colors"
            >
              {item.manga && (
                <div className="w-16 h-24 shrink-0">
                  <MangaCover src={item.manga.coverUrl} alt={item.manga.title} />
                </div>
              )}
              <div className="flex-1 min-w-0 py-3 pr-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/manga/${encodeURIComponent(item.mangaId)}`}
                      className="font-semibold text-sm text-foreground hover:underline block truncate"
                    >
                      {item.manga?.title ?? 'Unknown'}
                    </Link>
                    <p className="text-xs text-primary font-medium mt-0.5">
                      {item.newChapters} new chapter{item.newChapters > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.latestChapter && (
                      <Link
                        href={`/reader/${encodeURIComponent(item.latestChapter.id)}?manga=${encodeURIComponent(item.mangaId)}`}
                        className="text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
                      >
                        Read
                      </Link>
                    )}
                    <button
                      onClick={() => void handleRefresh(item.mangaId)}
                      disabled={refreshingIds.has(item.mangaId)}
                      className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
