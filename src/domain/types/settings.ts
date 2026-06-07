export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  readerMode: 'vertical-scroll' | 'webtoon' | 'single-page' | 'horizontal-swipe';
  readingDirection: 'rtl' | 'ltr';
  pageFitMode: 'fit-width' | 'fit-height' | 'fill' | 'original' | 'auto';
  libraryViewMode: 'grid' | 'list';
  lastBackupAt?: string | null;
}
