'use client';

import { useState, useMemo } from 'react';
import { useFirestoreCollection } from '~/hooks/useFirestoreQuery';
import { EmptyState } from '~/components/common/EmptyState';
import { Plus, Folder, Edit2, Trash2, Check, X } from 'lucide-react';
import { useToast } from '~/hooks/useToast';
import { doc, setDoc, deleteDoc, updateDoc, writeBatch } from '~/infrastructure/db/db-gateway';
import { db } from '~/lib/firebase';
import { useAuth } from '~/lib/auth-context';
import type { Category, LibraryEntry } from '~/domain/types';

export default function CategoriesPage() {
  const { uid } = useAuth();
  const toast = useToast();
  const rawCategories = useFirestoreCollection<Category>(uid, 'categories');
  const allLibraryEntries = useFirestoreCollection<LibraryEntry>(uid, 'libraryEntries');

  const categories = useMemo(() => {
    if (!rawCategories) return undefined;
    return [...rawCategories].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [rawCategories]);

  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const maxOrder = categories?.reduce((max, c) => Math.max(max, c.sortOrder), -1) ?? -1;
      const id = `cat:${Date.now()}`;
      if (!uid) { toast.error('Login required'); return; }
      await setDoc(doc(db, 'users', uid, 'categories', id), {
        id,
        name,
        sortOrder: maxOrder + 1,
      });
      setNewName('');
      toast.success('Category created');
    } catch {
      toast.error('Failed to create category');
    } finally {
      setAdding(false);
    }
  };

  const handleRename = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    try {
      if (!uid) { toast.error('Login required'); return; }
      await updateDoc(doc(db, 'users', uid, 'categories', id), { name });
      setEditingId(null);
      toast.success('Category renamed');
    } catch {
      toast.error('Failed to rename category');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? Manga will not be removed from your library.`)) return;
    try {
      if (!uid) { toast.error('Login required'); return; }
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', uid, 'categories', id));

      if (allLibraryEntries) {
        allLibraryEntries.forEach((entry) => {
          if (entry.categories.includes(id)) {
            batch.update(doc(db, 'users', uid, 'libraryEntries', entry.mangaId), {
              categories: entry.categories.filter((c) => c !== id),
            });
          }
        });
      }

      await batch.commit();
      toast.success('Category deleted');
    } catch {
      toast.error('Failed to delete category');
    }
  };

  const getCategoryMangaCount = (categoryId: string) => {
    if (!allLibraryEntries) return 0;
    return allLibraryEntries.filter((e) => e.categories.includes(categoryId)).length;
  };

  if (categories === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-foreground leading-tight">Categories</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          {categories.length === 0 ? 'No categories' : `${categories.length} categories`}
        </p>
      </div>

      {/* Add New */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="New category name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 bg-secondary rounded-xl px-4 py-3 text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newName.trim()}
          className="px-4 rounded-xl bg-primary text-primary-foreground font-medium text-[14px] disabled:opacity-50 hover:bg-primary/90 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={Folder}
          title="No categories yet"
          description="Create categories to organize your manga library"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-card rounded-xl p-4 shadow-sm flex items-center gap-3"
            >
              <Folder className="w-5 h-5 text-muted-foreground shrink-0" />
              {editingId === cat.id ? (
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRename(cat.id)}
                    className="flex-1 bg-secondary rounded-lg px-3 py-1.5 text-sm"
                  />
                  <button onClick={() => handleRename(cat.id)} className="p-1.5 text-primary">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1.5 text-muted-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">{getCategoryMangaCount(cat.id)} manga</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingId(cat.id);
                        setEditName(cat.name);
                      }}
                      className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id, cat.name)}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-destructive/70 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
