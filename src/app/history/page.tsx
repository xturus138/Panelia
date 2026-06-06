'use client';

import { useFirestoreCollection } from '~/hooks/useFirestoreQuery';
import { EmptyState } from '~/components/common/EmptyState';
import { Clock } from 'lucide-react';
import Link from 'next/link';
import { MangaCover } from '~/components/common/MangaCover';
import type { ReadProgress, Manga, Chapter } from '~/domain/types';
import { useMemo } from 'react';
import { useAuth } from '~/lib/auth-context';

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString();
}

export default function HistoryPage() {
  const { uid } = useAuth();
  const progressList = useFirestoreCollection<ReadProgress>(uid, 'readProgress');
  const allManga = useFirestoreCollection<Manga>(uid, 'manga');
  const allChapters = useFirestoreCollection<Chapter>(uid, 'chapters');

  const history = useMemo(() => {
    if (!progressList || !allManga || !allChapters) return undefined;

    // Sort progressList by lastReadAt descending
    const sortedProgress = [...progressList].sort(
      (a, b) => new Date(b.lastReadAt).getTime() - new Date(a.lastReadAt).getTime()
    );

    // Merge: one entry per manga (same source), keep the latest
    const latestPerManga = new Map<string, ReadProgress>();
    for (const p of sortedProgress) {
      if (!latestPerManga.has(p.mangaId)) {
        latestPerManga.set(p.mangaId, p);
      }
    }

    const merged = [...latestPerManga.values()];
    const mangaMap = new Map(allManga.map((m) => [m.id, m]));
    const chaptersMap = new Map(allChapters.map((c) => [c.id, c]));

    return merged.map((p) => ({
      ...p,
      manga: mangaMap.get(p.mangaId),
      chapter: chaptersMap.get(p.chapterId),
    }));
  }, [progressList, allManga, allChapters]);

  if (history === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-foreground leading-tight">History</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          {history.length === 0 ? 'No reading history' : `${history.length} manga read`}
        </p>
      </div>

      {history.length === 0 ? (
        <EmptyState
          title="No reading history"
          description="Your reading history will appear here once you start reading manga"
        />
      ) : (
        <div className="flex flex-col gap-4">
          {history.map((item) => {
            if (!item.manga || !item.chapter) return null;
            return (
              <div
                key={item.chapterId}
                className="flex gap-4 p-3 bg-card rounded-2xl border border-border shadow-sm items-center hover:bg-muted/50 transition-colors"
              >
                <div className="w-16 h-24 shrink-0 rounded-xl overflow-hidden border border-border">
                  <MangaCover src={item.manga.coverUrl} alt={item.manga.title} />
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/manga/${encodeURIComponent(item.mangaId)}`}
                    className="font-semibold text-foreground text-sm hover:underline block truncate"
                  >
                    {item.manga.title}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    Chapter {item.chapter.chapterNumber}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-3">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatRelativeTime(item.lastReadAt)}</span>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2 pr-1">
                  <Link
                    href={`/reader/${encodeURIComponent(item.chapterId)}?manga=${encodeURIComponent(
                      item.mangaId
                    )}`}
                    className="text-xs px-3.5 py-1.5 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/95 transition-colors"
                  >
                    Resume
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
