'use client';

import { useEffect } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

export default function LibraryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Library error:', error); }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <AlertCircle className="mb-4 h-10 w-10 text-destructive" />
      <h2 className="mb-1 text-lg font-bold text-foreground">Failed to load library</h2>
      <p className="mb-5 max-w-sm text-sm text-muted-foreground">{error.message || 'Something went wrong loading your library.'}</p>
      <button onClick={reset} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        <RefreshCw className="h-4 w-4" /> Retry
      </button>
    </div>
  );
}
