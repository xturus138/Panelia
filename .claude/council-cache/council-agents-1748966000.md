# Council Analysis: Panelia Extension Architecture

**Question:** Should Panelia (PWA) adopt Approach 1 (Mihon-style extension system) or Approach 2 (Browse Mode / smart browser)?

**Providers consulted:** OpenAI (GPT-5.5 Pro) — only provider with API key available

## 🔳 OpenAI (GPT-5.5 Pro) — Agent Analysis

**Quality:** good | **Confidence:** high | **Retried:** no

### Key Recommendations
- **Build hybrid: Approach 2 (Browse Mode) as foundation, Approach 1 (Extension System) as future upgrade path.** Browse mode works day one with zero new infrastructure. Extension system requires solving sandboxed code execution, which is still an unsolved problem in browser PWAs.
- **Start with URL-pattern scraping (Approach 2) using a declarative site config format.** Define scraper patterns per domain as JSON/YAML configs (CSS selectors, XPath, pagination structure) instead of full TypeScript modules. Community contributes a config file, not code.
- **Graduate to a Web Worker sandbox for extension code only when config-based scraping hits hard limits** (sites with heavy JS rendering, anti-bot measures, or dynamic content that defies static selectors). Use `eval()` or `new Function()` inside a Worker with no DOM access and a hard CPU timer.
- **Keep SourceProvider TypeScript interface unchanged as the internal adapter.** Both approaches wrap into the same `getPopular()`, `getChapters()`, `getPages()` contract. The interface is architecture-independent — good design, keep it.
- **Do NOT attempt to embed iframes for cross-origin scraping.** CORS, CSP, and X-Frame-Options blocks make this unreliable. Use fetch with a lightweight CORS proxy or serverless function for server-side scraping instead.

### Unique Perspective
OpenAI emphasizes that the Browse Mode approach is underrated by developers trained to think in terms of plugin/extension APIs. The real bottleneck isn't executing extension code — it's that browser-based extension systems require either a build step (pre-compile) or eval() sandbox (security risk). Most PWA developers miss that URL scraping with declarative selectors is the path of least resistance, and can be iterated on safely without touching a single line of application code.

### Blind Spots
The approach assumes CORS and iframe embedding work more reliably than they do in practice. Many manga sites block cross-origin iframe embedding via `X-Frame-Options: DENY` or `Content-Security-Policy`. The Browse Mode iframe suggestion founders on this reality unless a server-side proxy is introduced — which conflicts with the "zero backend" constraint. Additionally, config-based scraping is fragile against site redesigns, and the response understates maintenance burden of keeping URL patterns working across dozens of independent sites.

---

## Synthesis

### The Core Problem

| Aspect | Approach 1 (Mihon-style) | Approach 2 (Browse Mode) |
|--------|--------------------------|--------------------------|
| **Execution model** | Run extension code in sandbox | Scrape/parse site content |
| **CORS** | Bypass needed (proxy/backend) | Bypass needed (proxy/backend) |
| **Source format** | JS/TS module per source | JSON config per domain |
| **User contrib** | Write code + PR | Submit config file |
| **Security risk** | Code execution in browser | DOM parsing only (safe) |
| **Fragility** | Stable (custom parser) | Fragile (site redesigns) |
| **Reader UX** | Read within PWA | Read on original site |
| **Dev complexity** | Very high | Low-medium |

### Critical Insight: CORS is The Real Wall

Both approaches hit the **same wall**: manga sites don't allow `fetch()` from `localhost:3000` or your PWA origin. A `https://mangadex.org` API call from `https://panelia.app` gets blocked by CORS unless the server explicitly allows it.

**Approach 1 needs:** Backend proxy to forward API calls, OR a browser extension companion (beyond PWA scope), OR sites that already allow CORS (rare).

**Approach 2 needs:** Same backend proxy for scraping, OR embed sites in iframe (blocked by X-Frame-Options), OR a browser extension companion.

**Conclusion:** **Neither approach works fully client-side** for arbitrary manga sites. Both need either:
1. A lightweight **backend proxy** (Cloudflare Worker, Vercel Edge Function, or simple Node server) that forwards requests and strips CORS headers
2. A **browser extension companion** (separate install from Chrome Web Store) that has cross-origin privileges

### The Right Architecture

Your existing `SourceProvider` interface is correct. The question is what sits *behind* it.

**Recommended: Browse Mode (Approach 2) + Backend Proxy + Declarative Configs**

```
┌─────────────────────────────────────────────────────┐
│                   Panelia PWA                       │
│                                                     │
│   SourceProvider (unchanged interface)              │
│        │                                            │
│        ├── MangaDexAdapter (existing REST API)      │
│        ├── ComickAdapter (existing REST API)        │
│        └── ScrapeAdapter (new)                      │
│                │                                    │
│                └── SiteConfig[domain].json          │
│                        ├── selectors: {}            │
│                        ├── pagination: {}           │
│                        └── urls: {}                 │
│                                                     │
│        Panelia fetches → Backend Proxy → Target Site│
└─────────────────────────────────────────────────────┘
```

**Game plan:**
1. Your existing MangaDex/Comick providers keep working as-is (they use permissive APIs)
2. Add a `ScrapeAdapter` that takes a URL + JSON config → extracts manga data
3. Route scrape requests through a tiny proxy (Cloudflare Worker, ~50 lines)
4. When user "adds a source," they paste a domain; app looks up community config

### What The Browse Mode Actually Looks Like

Not an iframe (too many blocks). More like:

**Search/Browse view:** User types a URL or picks a site. PWA fetches the site's HTML **through the proxy**, parses selectors from config, renders manga list as native cards.

**Reader view:** User clicks a chapter. PWA fetches page images **through the proxy**, renders in existing reader component (vertical scroll). Progress tracking works exactly as it does now — the PWA owns the reading experience, not the source site.

**"Save" = adding to library.** Works identically to current code. The PWA tracks which chapters you've read, your last page, etc. No bookmark workaround needed.

### Why This Beats Iframe-ception

The "browser in a browser" idea (iframe) is seductive but breaks on:
- `X-Frame-Options: DENY` (most manga sites)
- `Content-Security-Policy: frame-ancestors 'none'`
- CORS issues for iframe communication (`postMessage` works but fragile)
- Can't style or extract content from cross-origin iframe
- Awful mobile UX (pinch zoom hell)

### Summary Verdict

| Criterion | Approach 1 | Approach 2 | Hybrid (recommended) |
|-----------|-----------|-----------|---------------------|
| Build effort | 3-4 weeks | 1-2 weeks | 2-3 weeks |
| Source support | By coding | By config | Both |
| User experience | Best | Good | Best |
| Maintenance | Low per source | Medium per source | Low-medium |
| Security risk | Medium (eval) | Low (parsing) | Low |
| Feasibility | Hard in PWA | Feasible | Feasible |

**Go with Approach 2 as Phase 1. Let community contribute configs. Graduate to code-based extensions only if/when config scraping hits unsolvable limits.**
