'use client';

import { useEffect, useState } from 'react';
import { useSettingsStore } from '~/store/useSettingsStore';
import { useTheme } from 'next-themes';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const settings = useSettingsStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-3">App Theme</h2>
          <select
            className="w-full p-2 rounded bg-muted border border-border"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="system">System Default</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Reader Mode</h2>
          <select
            className="w-full p-2 rounded bg-muted border border-border"
            value={settings.readerMode}
            onChange={(e) => settings.updateSettings({ readerMode: e.target.value as 'vertical-scroll' | 'webtoon' | 'single-page' | 'double-page' })}
          >
            <option value="vertical-scroll">Vertical Scroll</option>
            <option value="single-page">Single Page</option>
            <option value="webtoon">Webtoon</option>
          </select>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Source Filters</h2>
          <div className="mb-4">
            <label className="block mb-2">Language</label>
            <select
              className="w-full p-2 rounded bg-muted border border-border"
              value={settings.languageFilter}
              onChange={(e) => settings.updateSettings({ languageFilter: e.target.value })}
            >
              <option value="all">All Languages</option>
              <option value="en">English</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="zh">Chinese</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="nsfw"
              checked={settings.showNsfw}
              onChange={(e) => settings.updateSettings({ showNsfw: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="nsfw">Show NSFW sources</label>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Data</h2>
          <button
            className="w-full p-2 bg-destructive text-destructive-foreground rounded font-medium"
            onClick={() => alert('Wipe database not implemented in MVP')}
          >
            Clear Local Data
          </button>
        </section>
      </div>
    </div>
  );
}