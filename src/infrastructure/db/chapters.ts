import { db } from '~/db/db';
import type { Chapter } from '~/domain/types';

export async function getChapterById(id: string): Promise<Chapter | undefined> {
  return db.chapters.get(id) as Promise<Chapter | undefined>;
}

export async function getChaptersByMangaId(mangaId: string): Promise<Chapter[]> {
  return (await db.chapters.where('mangaId').equals(mangaId).toArray()) as Chapter[];
}

export async function saveChapters(chapters: Chapter[]): Promise<void> {
  if (!chapters.length) return;
  await db.chapters.bulkPut(chapters);
}
