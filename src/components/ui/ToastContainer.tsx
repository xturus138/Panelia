'use client'

import { useToastStore, ToastItem as IToastItem } from '~/stores/toast'
import { CheckCircle, AlertCircle, Loader2, X } from 'lucide-react'
import { useEffect } from 'react'

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts)
  const removeToast = useToastStore((state) => state.removeToast)

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 sm:px-0 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: IToastItem; onDismiss: () => void }) {
  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(onDismiss, toast.duration)
      return () => clearTimeout(timer)
    }
  }, [toast.duration, onDismiss])

  const typeStyles = {
    success: 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400',
    error: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
    loading: 'bg-primary/10 border-primary/20 text-primary',
  }

  const Icons = {
    success: CheckCircle,
    error: AlertCircle,
    loading: Loader2,
  }

  const Icon = Icons[toast.type as 'success' | 'error' | 'loading']

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg transition-all animate-fade-in ${typeStyles[toast.type as 'success' | 'error' | 'loading']} bg-background/80`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className={`w-4 h-4 flex-shrink-0 ${toast.type === 'loading' ? 'animate-spin' : ''}`} />
        <p className="text-sm font-medium leading-tight truncate">{toast.message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="p-1 rounded-lg hover:bg-foreground/5 text-foreground/40 hover:text-foreground/70 transition-colors flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
