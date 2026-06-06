'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '~/db/db';
import { EmptyState } from '~/components/common/EmptyState';
import { Bell, RefreshCw, Loader2, ChevronRight } from 'lucide-react';
import { MangaCover } from '~/components/common/MangaCover';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { syncChapters } from '~/db/sync';
import { useToast } from '~/hooks/useToast';

export default function UpdatesPage() {
  const toast = useToast();
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const [refreshAllLoading, setRefreshAllLoading] = useState(false);

  const libraryEntries = useLiveQuery(() => db.libraryEntries.toArray());

  const updates = useLiveQuery(async () => {
    if (!libraryEntries) return null;

    const mangaIds = libraryEntries.map((e) => e.mangaId);
    if (mangaIds.length === 0) return [];

    const allManga = await db.manga.where('id').anyOf(mangaIds).toArray();
    const allChapters = await db.chapters.where('mangaId').anyOf(mangaIds).toArray();

    const mangaMap = new Map(allManga.map((m) => [m.id, m]));

    const grouped = allChapters
      .filter((ch) => ch.status === 'unread')
      .reduce<Record<string, typeof allChapters>>((acc, ch) => {
        if (!acc[ch.mangaId]) acc[ch.mangaId] = [];
        acc[ch.mangaId].push(ch);
        return acc;
      }, {});

    return Object.entries(grouped)
      .map(([mangaId, chapters]) => ({
        mangaId,
        manga: mangaMap.get(mangaId),
        newChapters: chapters.length,
        latestChapter: chapters.sort((a, b) => b.chapterNumber - a.chapterNumber)[0],
      }))
      .filter((u) => u.manga)
      .sort((a, b) => {
        const aDate = a.latestChapter?.viewedAt || '';
        const bDate = b.latestChapter?.viewedAt || '';
        return bDate.localeCompare(aDate);
      });
  }, [libraryEntries]);

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

  if (updates === null) {
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
            {(updates?.length ?? 0) === 0 ? 'No new chapters' : `${updates?.length ?? 0} manga with updates`}
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

      {(updates ?? []).length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No updates"
          description="Add manga to your library to see new chapter updates here"
          action={{ label: 'Browse Manga', href: '/browse' }}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {(updates ?? []).map((u) => (
            <div
              key={u.mangaId}
              className="bg-card rounded-xl p-3 shadow-sm flex items-center gap-3"
            >
              <Link href={`/manga/${encodeURIComponent(u.mangaId)}`} className="shrink-0">
                <div className="w-12 h-16 rounded-lg overflow-hidden">
                  <MangaCover
                    src={u.manga!.coverUrl}
                    alt={u.manga!.title}
                    aspectRatio="3/4"
                    objectFit="cover"
                  />
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/manga/${encodeURIComponent(u.mangaId)}`}
                  className="block font-medium text-[14px] text-card-foreground truncate hover:underline"
                >
                  {u.manga!.title}
                </Link>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {u.newChapters} new chapter{u.newChapters > 1 ? 's' : ''}
                  {u.latestChapter && (
                    <> — Ch. {u.latestChapter.chapterNumber}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleRefresh(u.mangaId)}
                  disabled={refreshingIds.has(u.mangaId)}
                  className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${refreshingIds.has(u.mangaId) ? 'animate-spin' : ''}`} />
                </button>
                <Link
                  href={`/manga/${encodeURIComponent(u.mangaId)}`}
                  className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"
                >
                  <ChevronRight className="w-4 h-4 text-primary" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
