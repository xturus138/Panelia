'use client'

import { useEffect, useState } from 'react'
import { useSettingsStore } from '~/presentation/stores'
import { useTheme } from 'next-themes'
import { Moon, Sun, Monitor, Book, Trash2, ChevronRight, LogIn, LogOut, Cloud, CloudOff } from 'lucide-react'
import { db } from '~/lib/firebase'
import { terminate, clearIndexedDbPersistence } from '~/infrastructure/db/db-gateway'
import { useToast } from '~/hooks/useToast'
import { exportBackup, importBackup, validateBackup, firebaseAdapter } from '~/infrastructure/backup'
import { blobStore } from '~/services/downloads/blob-store'
import { useAuth } from '~/lib/auth-context'
import Link from 'next/link'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const settings = useSettingsStore()
  const toast = useToast()
  const { user, loading: authLoading, signInWithGoogle, logout } = useAuth()
  const isSignedIn = !!user
  const [mounted, setMounted] = useState(false)
  const [importing, setImporting] = useState(false)
  const [cloudSyncing, setCloudSyncing] = useState(false)
  const [pendingBackup, setPendingBackup] = useState<any>(null)
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace')
  const [showImportWarning, setShowImportWarning] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const confirmImport = async () => {
    if (!pendingBackup) return
    setImporting(true)
    try {
      await importBackup(pendingBackup, importMode)
      toast.success('Backup restored successfully')
      setShowImportWarning(false)
      setPendingBackup(null)
    } catch (err) {
      toast.error('Failed to restore backup: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setImporting(false)
    }
  }

  const handleCloudSync = async () => {
    if (!isSignedIn) {
      toast.error('Please sign in to sync with cloud')
      return
    }
    setCloudSyncing(true)
    try {
      const backup = await exportBackup()
      await firebaseAdapter.pushBackup(backup, user!.uid)
      settings.updateSettings({ lastBackupAt: new Date().toISOString() })
      toast.success('Backup synced to cloud')
    } catch (err) {
      toast.error('Failed to sync backup: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setCloudSyncing(false)
    }
  }

  const handleCloudRestore = async () => {
    if (!isSignedIn) {
      toast.error('Please sign in to restore from cloud')
      return
    }
    setCloudSyncing(true)
    try {
      const backup = await firebaseAdapter.pullBackup(user!.uid)
      if (!backup) {
        toast.error('No cloud backup found')
        return
      }
      setPendingBackup(backup)
      setShowImportWarning(true)
    } catch (err) {
      toast.error('Failed to load cloud backup: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setCloudSyncing(false)
    }
  }

  if (!mounted) {
    return (
      <div className="px-4 pt-6">
        <div className="h-8 w-32 bg-secondary rounded animate-pulse mb-2" />
        <div className="h-4 w-48 bg-secondary rounded animate-pulse" />
      </div>
    )
  }

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  const readerModes = [
    { value: 'vertical-scroll', label: 'Vertical Scroll' },
    { value: 'webtoon', label: 'Webtoon' },
    { value: 'single-page', label: 'Single Page' },
    { value: 'horizontal-swipe', label: 'Horizontal Swipe' },
  ]


  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-foreground leading-tight">Settings</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Customize your reading experience
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Account Section */}
        <section className="bg-card rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <LogIn className="w-4 h-4" />
            Account
          </h2>
          {isSignedIn ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-foreground truncate">
                  {user?.displayName ?? user?.email ?? 'Signed in'}
                </p>
                <p className="text-[12px] text-muted-foreground truncate">{user?.email ?? user?.uid}</p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await logout()
                    toast.success('Signed out')
                  } catch {
                    toast.error('Failed to sign out')
                  }
                }}
                className="py-2 px-3 rounded-xl bg-secondary text-secondary-foreground font-medium text-[13px] hover:bg-secondary/80 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={async () => {
                if (authLoading) return
                try {
                  await signInWithGoogle()
                  toast.success('Signed in')
                } catch (err) {
                  toast.error('Sign in failed')
                }
              }}
              disabled={authLoading}
              className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-medium text-[14px] hover:bg-primary/90 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              {authLoading ? 'Checking...' : 'Sign in with Google'}
            </button>
          )}
        </section>

        {/* Theme Section */}
        <section className="bg-card rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Sun className="w-4 h-4" />
            Appearance
          </h2>
          <div className="flex gap-2">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex-1 py-3 rounded-xl flex flex-col items-center gap-2 transition-all ${
                  theme === value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Reader Mode Section */}
        <section className="bg-card rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Book className="w-4 h-4" />
            Reader Mode
          </h2>
          <div className="flex flex-col gap-2">
            {readerModes.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => settings.updateSettings({ readerMode: value as any })}
                className={`w-full py-3 px-4 rounded-xl flex items-center justify-between transition-all ${
                  settings.readerMode === value
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                <span className="text-[14px] font-medium">{label}</span>
                {settings.readerMode === value && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>

          {/* Reading Direction */}
          <div className="mt-4">
            <label className="text-[13px] text-muted-foreground mb-2 block">Reading Direction</label>
            <div className="flex gap-2">
              {[
                { value: 'ltr', label: 'Left to Right' },
                { value: 'rtl', label: 'Right to Left' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => settings.updateSettings({ readingDirection: value as any })}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-[13px] font-medium transition-all ${
                    settings.readingDirection === value
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Page Fit Mode */}
          <div className="mt-4">
            <label className="text-[13px] text-muted-foreground mb-2 block">Page Fit Mode</label>
            <div className="flex gap-2">
              {[
                { value: 'fit-width', label: 'Fit Width' },
                { value: 'fit-height', label: 'Fit Height' },
                { value: 'fill', label: 'Fill' },
                { value: 'original', label: 'Original' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => settings.updateSettings({ pageFitMode: value as any })}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-[12px] font-medium transition-all ${
                    settings.pageFitMode === value
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>



        {/* Cloud Backup & Restore */}
        <section className="bg-card rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Cloud className="w-4 h-4" />
              Cloud Backup
            </h2>
            {settings.lastBackupAt && (
              <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                Last: {new Date(settings.lastBackupAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {isSignedIn ? (
            <div className="flex gap-2">
              <button
                onClick={handleCloudSync}
                disabled={cloudSyncing}
                className="flex-1 py-3 px-4 rounded-xl bg-primary text-primary-foreground font-medium text-[14px] hover:bg-primary/90 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Cloud className="w-4 h-4" />
                {cloudSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
              <button
                onClick={handleCloudRestore}
                disabled={cloudSyncing}
                className="flex-1 py-3 px-4 rounded-xl bg-secondary text-secondary-foreground font-medium text-[14px] hover:bg-secondary/80 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CloudOff className="w-4 h-4" />
                {cloudSyncing ? 'Loading...' : 'Restore'}
              </button>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">Sign in to enable cloud backup</p>
          )}
        </section>

        {/* Import Warning Modal */}
        {showImportWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-card w-full max-w-sm rounded-2xl p-6 shadow-xl border border-border animate-in fade-in zoom-in duration-200">
              <h3 className="text-lg font-bold text-foreground mb-2">Restore Backup</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to restore this backup?
                Consider <button onClick={handleCloudSync} className="text-primary font-medium hover:underline">creating a current backup</button> first.
              </p>

              <div className="space-y-3 mb-6">
                <button
                  onClick={() => setImportMode('replace')}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    importMode === 'replace'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-secondary/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">Replace All Data</span>
                    {importMode === 'replace' && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground">Wipes local library and replaces it with backup.</p>
                </button>

                <button
                  onClick={() => setImportMode('merge')}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    importMode === 'merge'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-secondary/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">Merge Data</span>
                    {importMode === 'merge' && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground">Adds missing manga and progress, keeping existing data.</p>
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowImportWarning(false)}
                  className="flex-1 py-3 px-4 rounded-xl bg-secondary text-secondary-foreground font-medium text-sm hover:bg-secondary/80"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmImport}
                  disabled={importing}
                  className="flex-1 py-3 px-4 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {importing ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Data Section */}
        <section className="bg-card rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Data
          </h2>
          <button
            className="w-full py-3 px-4 rounded-xl bg-destructive/10 text-destructive font-medium flex items-center justify-between hover:bg-destructive/20 transition-colors"
            onClick={async () => {
              if (confirm('Are you sure you want to clear all local data? This cannot be undone.')) {
                try {
                  await terminate(db);
                  await clearIndexedDbPersistence(db);
                  await blobStore.deleteAll();
                  toast.success('Local data cleared successfully. Reloading...');
                  setTimeout(() => window.location.reload(), 1500);
                } catch (err) {
                  toast.error('Failed to clear data: ' + (err instanceof Error ? err.message : String(err)));
                }
              }
            }}
          >
            <span className="text-[14px]">Clear Local Data</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </section>
      </div>
    </div>
  )
}