import { create } from 'zustand';

interface ReaderState {
  isReaderOpen: boolean;
  currentChapterId: string | null;
  mangaId: string | null;
  currentPage: number;
  showControls: boolean;
  setReaderOpen: (open: boolean) => void;
  setChapter: (mangaId: string, chapterId: string) => void;
  setPage: (page: number) => void;
  toggleControls: () => void;
}

export const useReaderStore = create<ReaderState>((set) => ({
  isReaderOpen: false,
  currentChapterId: null,
  mangaId: null,
  currentPage: 1,
  showControls: false,
  setReaderOpen: (open) => set({ isReaderOpen: open }),
  setChapter: (mangaId, chapterId) => set({ mangaId, currentChapterId: chapterId, currentPage: 1 }),
  setPage: (page) => set({ currentPage: page }),
  toggleControls: () => set((state) => ({ showControls: !state.showControls })),
}));