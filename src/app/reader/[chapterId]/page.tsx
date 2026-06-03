"use client";

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mockSource } from '~/services/mock-source';
import type { Page } from '~/types';

export default function ReaderPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = use(params);
  const router = useRouter();

  const [pages, setPages] = useState<Page[]>([]);
  const [controlsVisible, setControlsVisible] = useState(false);

  useEffect(() => {
    mockSource.getPages(chapterId).then(setPages);
  }, [chapterId]);

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col overflow-y-auto">
      {/* Pages Container - Vertical Scroll Mode for MVP */}
      <div
        className="flex-1 w-full max-w-3xl mx-auto flex flex-col"
        onClick={() => setControlsVisible(!controlsVisible)}
      >
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