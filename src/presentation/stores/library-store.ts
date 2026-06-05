import { create } from 'zustand';

interface LibraryState {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeCategoryId: string | null;
  setActiveCategory: (id: string | null) => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  activeCategoryId: null,
  setActiveCategory: (id) => set({ activeCategoryId: id }),
}));