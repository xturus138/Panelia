'use client'

import { useEffect, useState } from 'react'
import { useSettingsStore } from '~/presentation/stores'
import { useTheme } from 'next-themes'
import { Moon, Sun, Monitor, Book, Globe, Eye, Trash2, ChevronRight } from 'lucide-react'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const settings = useSettingsStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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

  const languages = [
    { value: 'all', label: 'All Languages' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' },
    { value: 'zh', label: 'Chinese' },
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
        </section>

        {/* Language Filter Section */}
        <section className="bg-card rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Source Filters
          </h2>

          {/* Language Dropdown */}
          <div className="mb-4">
            <label className="text-[13px] text-muted-foreground mb-2 block">Language</label>
            <select
              className="w-full p-3 rounded-xl bg-secondary text-secondary-foreground appearance-none cursor-pointer"
              value={settings.languageFilter}
              onChange={(e) => settings.updateSettings({ languageFilter: e.target.value })}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23888888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                backgroundSize: '16px',
              }}
            >
              {languages.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* NSFW Toggle */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5 text-muted-foreground" />
              <span className="text-[14px] font-medium">Show NSFW sources</span>
            </div>
            <button
              onClick={() => settings.updateSettings({ showNsfw: !settings.showNsfw })}
              className={`w-12 h-7 rounded-full transition-colors relative ${
                settings.showNsfw ? 'bg-primary' : 'bg-secondary'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.showNsfw ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </section>

        {/* Data Section */}
        <section className="bg-card rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Data
          </h2>
          <button
            className="w-full py-3 px-4 rounded-xl bg-destructive/10 text-destructive font-medium flex items-center justify-between hover:bg-destructive/20 transition-colors"
            onClick={() => {
              if (confirm('Are you sure you want to clear all local data? This cannot be undone.')) {
                // Clear database logic would go here
                alert('Clear data not implemented in MVP')
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