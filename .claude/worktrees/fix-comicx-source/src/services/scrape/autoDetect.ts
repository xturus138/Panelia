// src/services/scrape/autoDetect.ts
// Heuristic auto-detection of SiteConfig from a manga page's HTML.
// Picks CSS selectors that are likely to extract the right data for a
// generic manga site. Returns a best-guess config the user can tweak.

import { parse as parseHtml } from 'node-html-parser';
import type { SiteConfig } from './types';

const NOISE_WORDS = ['logo', 'avatar', 'icon', 'sprite', 'loading', 'placeholder', 'spinner', 'thumb-categories'];

function isNoise(src: string, alt: string): boolean {
  const s = (src + ' ' + alt).toLowerCase();
  return NOISE_WORDS.some((w) => s.includes(w));
}

function isInChrome(node: ReturnType<ReturnType<typeof parseHtml>['querySelector']>): boolean {
  let cur: ReturnType<ReturnType<typeof parseHtml>['querySelector']> | null = node;
  while (cur) {
    const tag = (cur.tagName || '').toLowerCase();
    if (tag === 'header' || tag === 'footer' || tag === 'nav' || tag === 'aside') return true;
    const id = (cur.id || '').toLowerCase();
    const cls = (cur.getAttribute?.('class') || '').toLowerCase();
    if (/(header|footer|navbar|sidebar|menu|breadcrumb|comment|share|social)/.test(id + ' ' + cls)) {
      return true;
    }
    cur = cur.parentNode as any;
  }
  return false;
}

function attrNum(el: any, name: string): number {
  const v = parseInt(el?.getAttribute?.(name) || '', 10);
  return Number.isFinite(v) ? v : 0;
}

function detectCover(root: ReturnType<typeof parseHtml>): string {
  // 1. Prefer og:image meta tag (very high confidence)
  const ogImg = root.querySelector('meta[property="og:image"]')?.getAttribute('content');
  if (ogImg) {
    // We can't directly use the meta content as a selector,
    // but we can look for an img tag matching this src.
    const matchingImg = root.querySelectorAll('img').find(img =>
      img.getAttribute('src') === ogImg || img.getAttribute('data-src') === ogImg
    );
    if (matchingImg) return bestSelectorForImg(matchingImg);
  }

  // 2. Heuristic scoring
  const candidates = root.querySelectorAll('img');
  let bestSelector = 'img';
  let bestScore = -1;

  for (const img of candidates) {
    const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
    if (!src) continue;
    if (isNoise(src, img.getAttribute('alt') || '')) continue;
    if (isInChrome(img)) continue;

    let score = 0;
    // Walk up to find cover-ish containers
    let ancestor: any = img;
    while (ancestor) {
      const id = (ancestor.id || '').toLowerCase();
      const cls = (ancestor.getAttribute?.('class') || '').toLowerCase();
      if (/(cover|thumb|poster|hero|manga-image|featured)/.test(id + ' ' + cls)) score += 50;
      if (ancestor.tagName?.toLowerCase() === 'figure') score += 10;
      ancestor = ancestor.parentNode;
    }
    // Specific class hints
    const imgCls = (img.getAttribute('class') || '').toLowerCase();
    if (/(wp-post-image|attachment-)/.test(imgCls)) score += 100;
    if (/(cover|thumb|poster)/.test(imgCls)) score += 40;

    // Dimension hints (from attributes)
    const w = attrNum(img, 'width');
    const h = attrNum(img, 'height');
    if (w > 150 && h > 200) score += 20;
    if (w > 0 && h > 0 && h > w) score += 15; // Portrait aspect ratio is common for covers

    if (score > bestScore) {
      bestScore = score;
      bestSelector = bestSelectorForImg(img);
    }
  }

  return bestSelector;
}

function bestSelectorForImg(el: any): string {
  if (el.id) return `#${el.id}`;
  const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean);
  if (cls.length) {
    // Avoid very generic or long dynamic classes
    const goodCls = cls.find((c: string) => !/^(img|image|lazy|loaded|attachment|size-)/i.test(c) && c.length < 30);
    if (goodCls) return `img.${goodCls}`;
    return `img.${cls[0]}`;
  }
  return 'img';
}

function detectTitle(root: ReturnType<typeof parseHtml>): string {
  // 1. Prefer og:title meta tag (high confidence)
  const ogTitle = root.querySelector('meta[property="og:title"]')?.getAttribute('content');
  if (ogTitle) {
    // Find an h1/h2 that matches most of the og:title
    const cleanOg = ogTitle.split(/[-|]/)[0].trim().toLowerCase();
    const headings = root.querySelectorAll('h1, h2');
    const match = headings.find(h => h.text.toLowerCase().includes(cleanOg));
    if (match) return selectorForHeading(match);
  }

  // 2. Heuristic scoring
  const candidates = root.querySelectorAll('h1, h2');
  let bestSelector = 'h1';
  let bestScore = -1;

  for (const h of candidates) {
    if (isInChrome(h)) continue;
    const text = h.text.trim();
    if (text.length < 2) continue;
    if (/(chapter|ch\.|episode|comment|reply|search|results)/i.test(text)) continue;

    let score = h.tagName?.toLowerCase() === 'h1' ? 50 : 20;
    const cls = (h.getAttribute('class') || '').toLowerCase();
    const id = (h.id || '').toLowerCase();

    if (/(title|name|judul|manga|post|entry)/.test(id + ' ' + cls)) score += 50;
    if (/(judul|title)/.test(id + ' ' + cls)) score += 30; // Stronger local keywords

    // Position hint: higher up is better
    // (not easy to get with node-html-parser without more complex traversal)

    if (score > bestScore) {
      bestScore = score;
      bestSelector = selectorForHeading(h);
    }
  }

  return bestSelector;
}

function selectorForHeading(el: any): string {
  if (el.id) return `#${el.id}`;
  const tag = (el.tagName || '').toLowerCase();
  const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean);
  if (cls.length) return `${tag}.${cls[0]}`;
  return tag;
}

function detectChapterList(root: ReturnType<typeof parseHtml>): { list: string; url: string; title: string } {
  // The scrape code treats each chapterList node as the chapter item itself
  // when chapterUrl is empty, so chapterList should match the <a> elements
  // directly. Pick the most specific selector that hits >=3 chapter-like
  // links. Fall back to anchor-level patterns, then to plain "a".

  const chapterLikeRe = /(chapter|ch\.|episode|\/ch-)/i;

  // 1. Try anchored by attribute substring — most specific first
  const attrSelectors = [
    'a[href*="chapter" i]',
    'a[href*="/ch-" i]',
    'a[href*="episode" i]',
  ];
  for (const sel of attrSelectors) {
    if (root.querySelectorAll(sel).length >= 3) return { list: sel, url: '', title: '' };
  }

  // 2. Try common class patterns (chapter-list items often share a class)
  const containers = root.querySelectorAll('ul, ol, div, section, table');
  for (const c of containers) {
    if (isInChrome(c)) continue;
    const links = c.querySelectorAll('a');
    const chapterCount = links.filter((a) => chapterLikeRe.test(a.getAttribute('href') || '')).length;
    if (chapterCount < 3) continue;
    // Find the dominant class across the chapter links
    const clsCounts: Record<string, number> = {};
    for (const a of links) {
      const cls = (a.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean);
      for (const c2 of cls) clsCounts[c2] = (clsCounts[c2] || 0) + 1;
    }
    const dominant = Object.entries(clsCounts).sort((a, b) => b[1] - a[1])[0];
    if (dominant && dominant[1] >= 3) return { list: `a.${dominant[0]}`, url: '', title: '' };
    // No dominant class — use container's selector + "a"
    const sel = selectorFor(c);
    if (sel.includes('.') || sel.includes('#')) return { list: `${sel} a`, url: '', title: '' };
    return { list: 'a', url: '', title: '' };
  }

  // 3. Last fallback
  return { list: 'a', url: '', title: '' };
}

function selectorFor(node: any): string {
  if (node.id) return `#${node.id}`;
  const tag = (node.tagName || '').toLowerCase();
  const cls = (node.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean);
  if (cls.length) return `${tag}.${cls[0]}`;
  return tag;
}

function detectChapterPageImages(): string {
  // Conservative default: any img in a likely reader container.
  return 'img';
}

export function autoDetectConfig(html: string, url: string): SiteConfig {
  const root = parseHtml(html);
  let baseUrl = url;
  let name = 'site';
  try {
    const u = new URL(url);
    baseUrl = u.origin;
    name = u.hostname.replace(/^www\./, '');
  } catch {}

  const titleSel = detectTitle(root);
  const coverSel = detectCover(root);
  const chap = detectChapterList(root);

  return {
    name,
    baseUrl,
    mangaPage: {
      title: titleSel,
      cover: coverSel,
      chapterList: chap.list,
      chapterTitle: chap.title,
      chapterUrl: chap.url,
    },
    chapterPage: {
      images: detectChapterPageImages(),
    },
  };
}
