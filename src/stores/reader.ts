import { create } from 'zustand'

interface ReaderState {
  isReaderOpen: boolean
  setReaderOpen: (open: boolean) => void
}

export const useReaderStore = create<ReaderState>((set) => ({
  isReaderOpen: false,
  setReaderOpen: (open) => set({ isReaderOpen: open }),
}))
