'use client';

import { useEffect } from 'react';
import { RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ReaderError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Reader error:', error); }, [error]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black px-4 text-center">
      <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
      <h2 className="mb-1 text-lg font-bold text-white">Reader error</h2>
      <p className="mb-5 max-w-sm text-sm text-white/60">{error.message || 'Something went wrong loading the reader.'}</p>
      <div className="flex gap-3">
        <Link href="/library" className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/20">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <button onClick={reset} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    </div>
  );
}
