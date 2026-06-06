import { collection, doc, setDoc } from 'firebase/firestore';
import { db as firestore } from '~/lib/firebase';
import { db as dexie } from '~/db/db';

export async function migrateDexieToFirestore() {
  if (typeof window === 'undefined') return;

  const flag = localStorage.getItem('panelia-dexie-migrated');
  if (flag === 'true') return;

  console.log('[Migration] Starting Dexie to Firestore migration...');

  try {
    // Check if Dexie database exists and has tables
    // Dexie might not be initialized yet, so we open it
    if (!dexie.isOpen()) {
      await dexie.open();
    }

    const tables = [
      { name: 'manga', collection: 'manga' },
      { name: 'chapters', collection: 'chapters' },
      { name: 'libraryEntries', collection: 'libraryEntries', key: 'mangaId' },
      { name: 'categories', collection: 'categories' },
      { name: 'readProgress', collection: 'readProgress', key: 'chapterId' },
      { name: 'downloadedChapters', collection: 'downloadedChapters' },
      { name: 'scrapeSources', collection: 'scrapeSources' },
    ];

    for (const table of tables) {
      const dexieTable = (dexie as any)[table.name];
      if (!dexieTable) continue;

      const items = await dexieTable.toArray();
      if (items.length > 0) {
        console.log(`[Migration] Migrating ${items.length} items from Dexie table "${table.name}" to Firestore...`);
        const firestoreCol = collection(firestore, table.collection);
        await Promise.all(
          items.map(async (item: any) => {
            const id = item[table.key || 'id'];
            if (id) {
              await setDoc(doc(firestoreCol, id), item, { merge: true });
            }
          })
        );
      }
    }

    // Migrate settings
    const settingsList = await dexie.settings.toArray();
    if (settingsList.length > 0) {
      console.log('[Migration] Migrating settings from Dexie to Firestore...');
      const settingsDocRef = doc(firestore, 'settings', 'app-settings');
      await setDoc(settingsDocRef, settingsList[0], { merge: true });
    }

    localStorage.setItem('panelia-dexie-migrated', 'true');
    console.log('[Migration] Dexie to Firestore migration completed successfully!');
  } catch (err) {
    console.error('[Migration] Failed to migrate Dexie to Firestore:', err);
  }
}
