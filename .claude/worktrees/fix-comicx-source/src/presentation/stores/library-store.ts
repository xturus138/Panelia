import { create } from 'zustand';

export type LibrarySortMode = 'last-read' | 'added' | 'alphabetical' | 'unread';

interface LibraryState {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeCategoryId: string | null;
  setActiveCategory: (id: string | null) => void;
  sortMode: LibrarySortMode;
  setSortMode: (mode: LibrarySortMode) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  activeCategoryId: null,
  setActiveCategory: (id) => set({ activeCategoryId: id }),
  sortMode: 'last-read',
  setSortMode: (mode) => set({ sortMode: mode }),
}));