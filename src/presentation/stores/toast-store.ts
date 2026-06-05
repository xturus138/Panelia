import { create } from 'zustand';

export type ToastType = 'loading' | 'success' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number | null;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Omit<ToastItem, 'id'>>) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    return id;
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  updateToast: (id, updates) => set((state) => ({
    toasts: state.toasts.map((t) => (t.id === id ? { ...t, ...updates } : t)),
  })),
}));