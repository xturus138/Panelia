import type { SiteConfig } from './types';

export interface ChapterInfo {
  id: string;
  title: string;
  chapterNumber: number;
}

interface ScrapeSession {
  config: SiteConfig;
  baseUrl: string;
  chapterUrls: Record<string, string>;
  mangaId: string;
  mangaTitle: string;
  mangaCoverUrl: string;
  sourceUrl: string;
  chapters: ChapterInfo[];
}

const sessions = new Map<string, ScrapeSession>();
const STORAGE_PREFIX = 'panelia:scrape-session:';

function getSessionFromStorage(sourceId: string): ScrapeSession | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const data = sessionStorage.getItem(STORAGE_PREFIX + sourceId);
    return data ? JSON.parse(data) : undefined;
  } catch {
    return undefined;
  }
}

function saveSessionToStorage(sourceId: string, session: ScrapeSession): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + sourceId, JSON.stringify(session));
  } catch (err) {
    console.warn('Failed to save scrape session to storage:', err);
  }
}

export function setScrapeSession(
  sourceId: string,
  config: SiteConfig,
  baseUrl: string,
  chapterUrls: Record<string, string>,
  mangaId: string,
  mangaTitle: string,
  mangaCoverUrl: string,
  sourceUrl: string,
  chapters: ChapterInfo[]
): void {
  const session = { config, baseUrl, chapterUrls, mangaId, mangaTitle, mangaCoverUrl, sourceUrl, chapters };
  sessions.set(sourceId, session);
  saveSessionToStorage(sourceId, session);
}

export function getScrapeSession(sourceId: string): ScrapeSession | undefined {
  let session = sessions.get(sourceId);
  if (!session) {
    session = getSessionFromStorage(sourceId);
    if (session) {
      sessions.set(sourceId, session);
    }
  }
  return session;
}

export function clearScrapeSession(sourceId: string): void {
  sessions.delete(sourceId);
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(STORAGE_PREFIX + sourceId);
  }
}
