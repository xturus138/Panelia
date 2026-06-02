import { create } from 'zustand';

interface ReaderState {
  currentChapterId: string | null;
  mangaId: string | null;
  currentPage: number;
  showControls: boolean;
  setChapter: (mangaId: string, chapterId: string) => void;
  setPage: (page: number) => void;
  toggleControls: () => void;
}

export const useReaderStore = create<ReaderState>((set) => ({
  currentChapterId: null,
  mangaId: null,
  currentPage: 1,
  showControls: false,
  setChapter: (mangaId, chapterId) => set({ mangaId, currentChapterId: chapterId, currentPage: 1 }),
  setPage: (page) => set({ currentPage: page }),
  toggleControls: () => set((state) => ({ showControls: !state.showControls })),
}));