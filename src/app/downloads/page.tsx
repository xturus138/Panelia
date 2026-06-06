'use client';

import { useFirestoreCollection } from '~/hooks/useFirestoreQuery';
import { Download, FileText } from 'lucide-react';
import { EmptyState } from '~/components/common/EmptyState';
import Link from 'next/link';
import type { DownloadedChapter, Manga } from '~/domain/types';
import { useMemo } from 'react';
import { MangaCover } from '~/components/common/MangaCover';

export default function DownloadsPage() {
  const downloadedChapters = useFirestoreCollection<DownloadedChapter>('downloadedChapters');
  const allManga = useFirestoreCollection<Manga>('manga');

  const downloadedWithManga = useMemo(() => {
    if (!downloadedChapters || !allManga) return undefined;
    const mangaMap = new Map(allManga.map((m) => [m.id, m]));
    return downloadedChapters.map((dc) => ({
      ...dc,
      manga: mangaMap.get(dc.mangaId),
    }));
  }, [downloadedChapters, allManga]);

  if (downloadedWithManga === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-foreground leading-tight">Downloads</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          {downloadedWithManga.length} downloaded chapters
        </p>
      </div>

      {downloadedWithManga.length === 0 ? (
        <EmptyState
          icon={Download}
          title="No downloads yet"
          description="Download chapters from manga details to read offline"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {downloadedWithManga.map((dc) => (
            <div
              key={dc.id}
              className="bg-card rounded-xl p-4 shadow-sm flex items-center gap-3 relative group"
            >
              <Link href={`/reader/${encodeURIComponent(dc.chapterId)}`} className="absolute inset-0 z-0" />
              {dc.manga?.coverUrl && (
                <div className="w-12 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative z-10">
                  <MangaCover url={dc.manga.coverUrl} title={dc.manga.title} />
                </div>
              )}
              <div className="flex-1 min-w-0 relative z-10">
                <p className="font-medium text-sm text-foreground truncate">{dc.manga?.title ?? 'Unknown'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Downloaded {new Date(dc.downloadedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="shrink-0 relative z-10">
                <FileText className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
