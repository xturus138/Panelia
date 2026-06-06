import { useMemo } from 'react'
import { useToastStore } from '~/presentation/stores/toast-store'

export function useToast() {
  const addToast = useToastStore((state) => state.addToast)
  const removeToast = useToastStore((state) => state.removeToast)
  const updateToast = useToastStore((state) => state.updateToast)

  return useMemo(() => ({
    success: (message: string, duration = 3000) => {
      return addToast({ type: 'success', message, duration })
    },
    error: (message: string, duration = 5000) => {
      return addToast({ type: 'error', message, duration })
    },
    loading: (message: string) => {
      const id = addToast({ type: 'loading', message, duration: null })
      return {
        id,
        update: (newMessage: string) => updateToast(id, { message: newMessage }),
        dismiss: () => removeToast(id),
      }
    },
    dismiss: (id: string) => removeToast(id),
  }), [addToast, removeToast, updateToast])
}
