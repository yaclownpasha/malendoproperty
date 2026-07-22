#!/usr/bin/env node

import { createHash } from 'node:crypto';

const BASE_URL = 'https://malendo-property.com';
const DEFAULT_MAX_INSPECTIONS = 120;
const DEFAULT_CONCURRENCY = 3;
const REQUEST_TIMEOUT_MS = 20000;
const MAX_REDIRECTS = 6;
const USER_AGENT = 'MalendoIndexationInventory/1.0 (+read-only public SEO audit)';

const CLASSIFICATIONS = [
  'commercial canonical',
  'supporting local content',
  'duplicate/language review',
  'product review',
  'author/taxonomy review',
  'legacy/broken',
  'manual GSC decision',
];

const KNOWN_URL_TYPES = [
  'homepage', 'page', 'properties hub', 'estate/property', 'rent landing', 'sell landing',
  'product', 'product category', 'author', 'post/blog', 'location/local page', 'project hub',
  'project', 'developer hub', 'developer', 'available', 'taxonomy/archive',
  'translated-language', 'legacy/demo', 'contact', 'submit application',
  'property management', 'unknown',
];

const KNOWN_SITEMAP_TYPES = [
  'page', 'estate', 'product', 'product-category', 'author', 'post', 'location',
  'project', 'developer', 'available', 'taxonomy', 'other', 'language-discovery',
];

const args = parseArgs(process.argv.slice(2));
const mode = args.flags.has('json')
  ? 'json'
  : args.flags.has('markdown')
    ? 'markdown'
    : args.flags.has('csv')
      ? 'csv'
      : 'console';
const inspectAll = args.flags.has('all');
const maxInspections = inspectAll
  ? Number.POSITIVE_INFINITY
  : positiveInteger(args.values.get('max-urls'), DEFAULT_MAX_INSPECTIONS);
const maxLanguageHosts = args.values.has('max-language-hosts')
  ? positiveInteger(args.values.get('max-language-hosts'), Number.POSITIVE_INFINITY)
  : Number.POSITIVE_INFINITY;
const concurrency = Math.min(6, positiveInteger(args.values.get('concurrency'), DEFAULT_CONCURRENCY));

if (args.flags.has('help')) {
  printUsage();
  process.exit(0);
}

function parseArgs(argv) {
  const parsed = { flags: new Set(), values: new Map() };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) continue;
    const key = argument.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      parsed.values.set(key, next);
      index += 1;
    } else {
      parsed.flags.add(key);
    }
  }
  return parsed;
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function printUsage() {
  console.log([
    'Usage:',
    '  node scripts/audit-malendo-indexation-inventory.mjs',
    '  node scripts/audit-malendo-indexation-inventory.mjs --markdown',
    '  node scripts/audit-malendo-indexation-inventory.mjs --json',
    '  node scripts/audit-malendo-indexation-inventory.mjs --csv',
    '',
    'Inspection controls:',
    `  --max-urls N     Inspect a deterministic sample (default: ${DEFAULT_MAX_INSPECTIONS})`,
    '  --all            Inspect every inventoried URL (potentially tens of thousands)',
    `  --concurrency N  Concurrent requests, capped at 6 (default: ${DEFAULT_CONCURRENCY})`,
    '  --max-language-hosts N  Limit translated-host HTTP inspection; all hosts remain inventoried',
    '',
    'The tool performs public GET requests only. It does not accept credentials or GSC data.',
  ].join('\n'));
}

function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x2F;|&#47;/gi, '/');
}

function stripTags(value) {
  return decodeEntities(String(value ?? ''))
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value, maximum = 120) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return normalized.length > maximum ? `${normalized.slice(0, maximum - 1)}...` : normalized;
}

function markdownCell(value) {
  return truncate(value, 180).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function attribute(tag, name) {
  const match = String(tag).match(new RegExp(`\\b${name}\\s*=\\s*(['"])([\\s\\S]*?)\\1`, 'i'));
  return match ? decodeEntities(match[2]).trim() : '';
}

function tags(html, name) {
  return String(html).match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
}

function absoluteUrl(value, base = BASE_URL) {
  try {
    return new URL(decodeEntities(value), base).href;
  } catch {
    return '';
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizedPath(pathname) {
  const path = `/${String(pathname ?? '').replace(/^\/+/, '')}`;
  return path !== '/' && !path.endsWith('/') ? `${path}/` : path;
}

function stableRank(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function contentSignature(text) {
  const normalized = String(text ?? '')
    .toLowerCase()
    .replace(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length < 120) return '';
  return createHash('sha256').update(normalized).digest('hex').slice(0, 20);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(response, attempt) {
  const retryAfter = response?.headers?.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 30000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.min(Math.max(date - Date.now(), 0), 30000);
  }
  return 700 * (2 ** attempt);
}

async function requestText(url, options = {}) {
  const redirects = [];
  let currentUrl = url;
  const retries = options.retries ?? 2;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    let response;
    let lastError = '';
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        response = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: {
            accept: options.accept ?? 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
            'user-agent': USER_AGENT,
          },
        });
        if ((response.status === 429 || response.status >= 500) && attempt < retries) {
          await sleep(retryDelay(response, attempt));
          continue;
        }
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        if (attempt < retries) await sleep(retryDelay(null, attempt));
      }
    }

    if (!response) {
      return {
        requestedUrl: url,
        finalUrl: currentUrl,
        status: 0,
        redirects,
        headers: {},
        body: '',
        error: lastError || 'Request failed',
      };
    }

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      const nextUrl = absoluteUrl(location, currentUrl);
      redirects.push({ from: currentUrl, status: response.status, to: nextUrl });
      if (!nextUrl) break;
      currentUrl = nextUrl;
      continue;
    }

    return {
      requestedUrl: url,
      finalUrl: currentUrl,
      status: response.status,
      redirects,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text(),
      error: '',
    };
  }

  return {
    requestedUrl: url,
    finalUrl: currentUrl,
    status: 0,
    redirects,
    headers: {},
    body: '',
    error: 'Redirect limit exceeded',
  };
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, () => run()));
  return results;
}

function xmlLocations(xml) {
  return [...String(xml).matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)]
    .map((match) => absoluteUrl(stripTags(match[1])))
    .filter(Boolean);
}

function xmlUrlEntries(xml) {
  return [...String(xml).matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)].map((match) => {
    const block = match[1];
    const loc = (block.match(/<loc\b[^>]*>([\s\S]*?)<\/loc>/i) ?? [])[1] ?? '';
    const lastmod = (block.match(/<lastmod\b[^>]*>([\s\S]*?)<\/lastmod>/i) ?? [])[1] ?? '';
    return { url: absoluteUrl(stripTags(loc)), lastmod: stripTags(lastmod) };
  }).filter((entry) => entry.url);
}

function sitemapType(url) {
  const name = new URL(url).pathname.split('/').filter(Boolean).pop()?.toLowerCase() ?? '';
  if (/product[_-]?cat|product-category/.test(name)) return 'product-category';
  if (/product/.test(name)) return 'product';
  if (/estate/.test(name)) return 'estate';
  if (/author|user/.test(name)) return 'author';
  if (/available/.test(name)) return 'available';
  if (/developer/.test(name)) return 'developer';
  if (/project/.test(name)) return 'project';
  if (/location|city|region|state|country|neighborhood|neighbourhood/.test(name)) return 'location';
  if (/post/.test(name)) return 'post';
  if (/page/.test(name)) return 'page';
  if (/categor|tag|taxonomy/.test(name)) return 'taxonomy';
  return 'other';
}

async function discoverSitemaps() {
  const rootUrl = `${BASE_URL}/sitemap_index.xml`;
  const queue = [rootUrl];
  const seen = new Set();
  const sitemapRecords = [];
  const urlEntries = [];

  while (queue.length) {
    const batch = queue.splice(0, concurrency).filter((url) => !seen.has(url));
    batch.forEach((url) => seen.add(url));
    const fetched = await mapLimit(batch, concurrency, async (url) => ({ url, response: await requestText(url, { accept: 'application/xml,text/xml,*/*' }) }));

    for (const { url, response } of fetched) {
      const isIndex = /<sitemapindex\b/i.test(response.body);
      const isUrlset = /<urlset\b/i.test(response.body);
      const children = isIndex ? xmlLocations(response.body) : [];
      const entries = isUrlset ? xmlUrlEntries(response.body) : [];
      const type = sitemapType(url);
      sitemapRecords.push({
        url,
        type,
        status: response.status,
        finalUrl: response.finalUrl,
        childSitemapCount: children.length,
        urlCount: entries.length,
        error: response.error,
      });
      children.filter((child) => !seen.has(child)).forEach((child) => queue.push(child));
      entries.forEach((entry) => urlEntries.push({ ...entry, sitemapUrl: url, sitemapType: type }));
    }
  }

  const deduplicated = new Map();
  for (const entry of urlEntries) {
    if (!deduplicated.has(entry.url)) {
      deduplicated.set(entry.url, { ...entry, alsoInSitemaps: [] });
    } else {
      deduplicated.get(entry.url).alsoInSitemaps.push(entry.sitemapUrl);
    }
  }
  return { rootUrl, sitemaps: sitemapRecords, entries: [...deduplicated.values()] };
}

function inferUrlType(input, sourceType = '') {
  let url;
  try {
    url = new URL(input);
  } catch {
    return 'unknown';
  }
  const path = normalizedPath(url.pathname).toLowerCase();
  const isPrimaryHost = url.hostname === new URL(BASE_URL).hostname;
  if (!isPrimaryHost) return 'translated-language';
  if (path === '/') return 'homepage';
  if (path === '/properties/') return 'properties hub';
  if (path === '/contact/') return 'contact';
  if (path === '/submit-your-application/') return 'submit application';
  if (path.includes('/services/property-management/')) return 'property management';
  if (path.startsWith('/product-category/') || sourceType === 'product-category') return 'product category';
  if (path.startsWith('/product/') || sourceType === 'product') return 'product';
  if (path.startsWith('/author/') || path.startsWith('/user/') || sourceType === 'author') return 'author';
  if (path.startsWith('/projects/') || sourceType === 'project') return path === '/projects/' ? 'project hub' : 'project';
  if (path.startsWith('/developers/') || sourceType === 'developer') return path === '/developers/' ? 'developer hub' : 'developer';
  if (path.startsWith('/properties/') || sourceType === 'estate') return 'estate/property';
  if (path.startsWith('/rent-property/')) return 'rent landing';
  if (path.startsWith('/sell-property/')) return 'sell landing';
  if (path.startsWith('/available/') || sourceType === 'available') return 'available';
  if (sourceType === 'location' || /\/(thailand|phuket|patong|kata|karon|kamala|rawai|bang-tao|bangtao)\//.test(path)) return 'location/local page';
  if (sourceType === 'post' || /^\/\d{4}\/\d{2}\//.test(path) || path.startsWith('/blog/')) return 'post/blog';
  if (sourceType === 'taxonomy' || path.startsWith('/category/') || path.startsWith('/tag/')) return 'taxonomy/archive';
  if (/\/(test(?:-\d+)?|about-me-2|advanced-search-form|video-fullscreen-buttons)\/$/.test(path)) return 'legacy/demo';
  if (sourceType === 'page') return 'page';
  return 'unknown';
}

function titleOf(html) {
  return stripTags((String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) ?? [])[1] ?? '');
}

function metaOf(html, wantedName) {
  for (const tag of tags(html, 'meta')) {
    const name = attribute(tag, 'name').toLowerCase();
    const property = attribute(tag, 'property').toLowerCase();
    if (name === wantedName.toLowerCase() || property === wantedName.toLowerCase()) return attribute(tag, 'content');
  }
  return '';
}

function canonicalOf(html) {
  for (const tag of tags(html, 'link')) {
    const rel = attribute(tag, 'rel').toLowerCase().split(/\s+/);
    if (rel.includes('canonical')) return absoluteUrl(attribute(tag, 'href'));
  }
  return '';
}

function h1Of(html) {
  return [...String(html).matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean);
}

function bodyTextOf(html) {
  const body = (String(html).match(/<body\b[^>]*>([\s\S]*?)<\/body>/i) ?? [])[1] ?? html;
  return stripTags(body);
}

function legacyMarkers(html) {
  const withoutOfficialSocials = String(html)
    .replace(/https?:\/\/(?:www\.)?instagram\.com\/malendo\.property\/?/gi, '')
    .replace(/https?:\/\/(?:www\.)?facebook\.com\/Malendo\.Property\/?/gi, '');
  return {
    oldEmail: /info@malendo\.property/i.test(withoutOfficialSocials),
    oldDomain: /(?:https?:)?\/\/malendo\.property(?:\/|["'?#\s<]|$)/i.test(withoutOfficialSocials),
    oldBrand: /Malendo\.property/i.test(withoutOfficialSocials),
  };
}

function addToCartMarker(html) {
  return /(?:add[_-]to[_-]cart|single_add_to_cart_button|name\s*=\s*['"]add-to-cart|wc-block-grid__product-add-to-cart)/i.test(html);
}

function hreflangLinks(html, base) {
  return tags(html, 'link').map((tag) => ({
    rel: attribute(tag, 'rel').toLowerCase(),
    hreflang: attribute(tag, 'hreflang').toLowerCase(),
    url: absoluteUrl(attribute(tag, 'href'), base),
  })).filter((entry) => entry.rel.split(/\s+/).includes('alternate') && entry.hreflang && entry.url);
}

function linkedLanguageHosts(html, base) {
  const baseHost = new URL(BASE_URL).hostname;
  const values = [];
  for (const tag of tags(html, 'a')) {
    const url = absoluteUrl(attribute(tag, 'href'), base);
    if (!url) continue;
    const hostname = new URL(url).hostname;
    if (hostname !== baseHost && hostname.endsWith(`.${baseHost}`)) values.push(url);
  }
  return unique(values);
}

function inspectHtml(response) {
  const html = response.body;
  const markers = legacyMarkers(html);
  const robots = unique([
    metaOf(html, 'robots'),
    response.headers['x-robots-tag'] ?? '',
  ]).join(', ');
  const bodyText = bodyTextOf(html);
  return {
    inspectionStatus: response.error ? 'transport-error' : 'inspected',
    httpStatus: response.status,
    finalUrl: response.finalUrl,
    redirectCount: response.redirects.length,
    redirectChain: response.redirects,
    robots,
    indexable: response.status === 200 && !/\bnoindex\b/i.test(robots),
    canonical: canonicalOf(html),
    title: titleOf(html),
    metaDescription: metaOf(html, 'description'),
    h1: h1Of(html),
    oldEmail: markers.oldEmail,
    oldDomain: markers.oldDomain,
    oldBrand: markers.oldBrand,
    addToCart: addToCartMarker(html),
    contentSignature: contentSignature(bodyText),
    contentWordCount: bodyText ? bodyText.split(/\s+/).length : 0,
    hreflang: hreflangLinks(html, response.finalUrl),
    linkedLanguageUrls: linkedLanguageHosts(html, response.finalUrl),
    transportError: response.error,
  };
}

function emptyInspection() {
  return {
    inspectionStatus: 'not-sampled',
    httpStatus: '',
    finalUrl: '',
    redirectCount: '',
    redirectChain: [],
    robots: '',
    indexable: '',
    canonical: '',
    title: '',
    metaDescription: '',
    h1: [],
    oldEmail: '',
    oldDomain: '',
    oldBrand: '',
    addToCart: '',
    contentSignature: '',
    contentWordCount: '',
    hreflang: [],
    linkedLanguageUrls: [],
    transportError: '',
  };
}

function deterministicSample(entries, maximum) {
  if (!Number.isFinite(maximum) || entries.length <= maximum) return entries;
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.urlType)) groups.set(entry.urlType, []);
    groups.get(entry.urlType).push(entry);
  }
  for (const values of groups.values()) values.sort((a, b) => stableRank(a.url).localeCompare(stableRank(b.url)));

  const selected = [];
  const groupNames = [...groups.keys()].sort();
  let round = 0;
  while (selected.length < maximum) {
    let added = false;
    for (const name of groupNames) {
      const candidate = groups.get(name)[round];
      if (candidate) {
        selected.push(candidate);
        added = true;
        if (selected.length === maximum) break;
      }
    }
    if (!added) break;
    round += 1;
  }

  const homepage = entries.find((entry) => entry.url === `${BASE_URL}/` || entry.url === BASE_URL);
  if (homepage && !selected.includes(homepage)) selected[selected.length - 1] = homepage;
  return uniqueObjects(selected, (entry) => entry.url);
}

function uniqueObjects(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function groupCounts(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item) || 'unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function groupCountsWithKnown(items, keyFn, knownValues) {
  const counts = groupCounts(items, keyFn);
  knownValues.forEach((value) => {
    if (!(value in counts)) counts[value] = 0;
  });
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function duplicateGroups(entries, field) {
  const groups = new Map();
  for (const entry of entries) {
    const value = String(entry[field] ?? '').trim();
    if (!value) continue;
    const key = field === 'title' ? value.toLowerCase() : value;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry.url);
  }
  return [...groups.entries()]
    .filter(([, urls]) => urls.length > 1)
    .map(([value, urls]) => ({ value, count: urls.length, urls: urls.sort() }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function commercialType(type) {
  return new Set([
    'homepage', 'properties hub', 'contact', 'submit application', 'property management',
    'estate/property', 'rent landing', 'sell landing',
  ]).has(type);
}

function supportingType(type) {
  return new Set(['post/blog', 'location/local page', 'project hub', 'project', 'developer hub', 'developer']).has(type);
}

function classify(entry) {
  const mainHost = new URL(BASE_URL).hostname;
  let offDomainRedirect = false;
  try {
    offDomainRedirect = Boolean(entry.finalUrl) && new URL(entry.finalUrl).hostname !== mainHost;
  } catch {
    offDomainRedirect = false;
  }
  if ((entry.httpStatus && entry.httpStatus >= 400) || entry.oldEmail === true || entry.oldDomain === true) return 'legacy/broken';
  if (entry.urlType === 'translated-language') return 'duplicate/language review';
  if (offDomainRedirect) return 'legacy/broken';
  if (entry.urlType === 'product' || entry.urlType === 'product category') return 'product review';
  if (['author', 'taxonomy/archive', 'available'].includes(entry.urlType)) return 'author/taxonomy review';
  if ((entry.duplicateTitleCount ?? 0) > 1 || (entry.duplicateContentCount ?? 0) > 1) return 'duplicate/language review';
  if (commercialType(entry.urlType)) return 'commercial canonical';
  if (supportingType(entry.urlType)) return 'supporting local content';
  if (entry.urlType === 'legacy/demo') return 'legacy/broken';
  return 'manual GSC decision';
}

function inventoryNote(entry) {
  const notes = [];
  if (entry.inspectionStatus === 'not-sampled') notes.push('HTML not sampled; join with GSC before deciding');
  if (entry.inspectionStatus === 'transport-error') notes.push(`Transport error: ${entry.transportError}`);
  if (entry.httpStatus && entry.httpStatus !== 200) notes.push(`HTTP ${entry.httpStatus}`);
  if (entry.canonical && entry.canonical !== entry.url) notes.push('Canonical differs from sitemap URL');
  if (entry.oldEmail) notes.push('Legacy email marker');
  if (entry.oldDomain) notes.push('Legacy domain marker');
  if (entry.addToCart) notes.push('Add to cart marker');
  if ((entry.duplicateTitleCount ?? 0) > 1) notes.push(`Duplicate title group: ${entry.duplicateTitleCount}`);
  if ((entry.duplicateContentCount ?? 0) > 1) notes.push(`Duplicate content signature group: ${entry.duplicateContentCount}`);
  return notes.join('; ');
}

async function inspectEntries(entries) {
  const sample = deterministicSample(entries, maxInspections);
  const results = await mapLimit(sample, concurrency, async (entry) => {
    const response = await requestText(entry.url);
    return [entry.url, inspectHtml(response)];
  });
  return new Map(results);
}

function languageCandidates(entries, inspectedMap) {
  const baseHost = new URL(BASE_URL).hostname;
  const candidates = [];
  for (const entry of entries) {
    const host = new URL(entry.url).hostname;
    if (host !== baseHost && host.endsWith(`.${baseHost}`)) candidates.push(entry.url);
  }
  for (const inspection of inspectedMap.values()) {
    inspection.hreflang.forEach((item) => candidates.push(item.url));
    inspection.linkedLanguageUrls.forEach((url) => candidates.push(url));
    inspection.redirectChain.forEach((item) => candidates.push(item.to));
  }
  return unique(candidates).filter((url) => {
    try {
      const host = new URL(url).hostname;
      return host !== baseHost && host.endsWith(`.${baseHost}`);
    } catch {
      return false;
    }
  });
}

async function inspectLanguageHosts(candidates, existingInspections) {
  const roots = unique(candidates.map((candidate) => {
    const url = new URL(candidate);
    return `${url.protocol}//${url.host}/`;
  })).sort();
  const selected = new Set((Number.isFinite(maxLanguageHosts) ? roots.slice(0, maxLanguageHosts) : roots));
  const inspectedRecords = await mapLimit([...selected], Math.min(concurrency, 2), async (url) => {
    const existing = existingInspections.get(url);
    const inspection = existing ?? inspectHtml(await requestText(url));
    return {
      url,
      sitemapUrl: '',
      sitemapType: 'language-discovery',
      alsoInSitemaps: [],
      lastmod: '',
      host: new URL(url).hostname,
      urlType: 'translated-language',
      ...inspection,
    };
  });
  const byUrl = new Map(inspectedRecords.map((record) => [record.url, record]));
  return roots.map((url) => byUrl.get(url) ?? {
    url,
    sitemapUrl: '',
    sitemapType: 'language-discovery',
    alsoInSitemaps: [],
    lastmod: '',
    host: new URL(url).hostname,
    urlType: 'translated-language',
    ...emptyInspection(),
  });
}

function enrichEntries(rawEntries, inspections, languageHosts) {
  const entries = rawEntries.map((entry) => {
    const url = new URL(entry.url);
    return {
      url: entry.url,
      sitemapUrl: entry.sitemapUrl,
      sitemapType: entry.sitemapType,
      alsoInSitemaps: entry.alsoInSitemaps,
      lastmod: entry.lastmod,
      host: url.hostname,
      urlType: inferUrlType(entry.url, entry.sitemapType),
      ...emptyInspection(),
      ...(inspections.get(entry.url) ?? {}),
    };
  });

  const sitemapUrls = new Set(entries.map((entry) => entry.url));
  const translatedHosts = languageHosts.filter((entry) => !sitemapUrls.has(entry.url));
  const allRecords = [...entries, ...translatedHosts];
  const titleGroups = duplicateGroups(allRecords, 'title');
  const contentGroups = duplicateGroups(allRecords, 'contentSignature');
  const titleCounts = new Map(titleGroups.flatMap((group) => group.urls.map((url) => [url, group.count])));
  const contentCounts = new Map(contentGroups.flatMap((group) => group.urls.map((url) => [url, group.count])));
  for (const entry of allRecords) {
    entry.duplicateTitleCount = titleCounts.get(entry.url) ?? 0;
    entry.duplicateContentCount = contentCounts.get(entry.url) ?? 0;
    entry.classification = classify(entry);
    entry.notes = inventoryNote(entry);
  }
  return { entries, translatedHosts, allRecords, duplicateTitles: titleGroups, duplicateContent: contentGroups };
}

function summarize(report) {
  const allRecords = [...report.entries, ...report.translatedHosts];
  const inspected = allRecords.filter((entry) => entry.inspectionStatus === 'inspected');
  const transportErrors = allRecords.filter((entry) => entry.inspectionStatus === 'transport-error');
  return {
    sitemapCount: report.sitemaps.length,
    sitemapErrors: report.sitemaps.filter((item) => item.status !== 200 || item.error).length,
    sitemapUrls: report.entries.length,
    inventoriedUrls: allRecords.length,
    inspectedUrls: inspected.length,
    uninspectedUrls: allRecords.filter((entry) => entry.inspectionStatus === 'not-sampled').length,
    transportErrors: transportErrors.length,
    translatedHosts: report.translatedHosts.length,
    urlCountsByType: groupCountsWithKnown(allRecords, (entry) => entry.urlType, KNOWN_URL_TYPES),
    urlCountsBySitemapType: groupCountsWithKnown(allRecords, (entry) => entry.sitemapType, KNOWN_SITEMAP_TYPES),
    classificationCounts: groupCountsWithKnown(allRecords, (entry) => entry.classification, CLASSIFICATIONS),
    statusCounts: groupCounts(allRecords.filter((entry) => entry.httpStatus !== ''), (entry) => String(entry.httpStatus)),
    oldEmailCount: inspected.filter((entry) => entry.oldEmail).length,
    oldDomainCount: inspected.filter((entry) => entry.oldDomain).length,
    addToCartCount: inspected.filter((entry) => entry.addToCart).length,
    duplicateTitleGroups: report.duplicateTitles.length,
    duplicateContentGroups: report.duplicateContent.length,
  };
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(' | ') : String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(report) {
  const columns = [
    'url', 'sitemap_url', 'sitemap_type', 'url_type', 'host', 'lastmod', 'inspection_status',
    'http_status', 'final_url', 'redirect_count', 'robots', 'indexable', 'canonical', 'title',
    'meta_description', 'old_email', 'old_domain', 'old_brand', 'add_to_cart', 'content_signature',
    'duplicate_title_count', 'duplicate_content_count', 'classification', 'notes',
  ];
  const rows = [...report.entries, ...report.translatedHosts].map((entry) => ({
    url: entry.url,
    sitemap_url: entry.sitemapUrl,
    sitemap_type: entry.sitemapType,
    url_type: entry.urlType,
    host: entry.host,
    lastmod: entry.lastmod,
    inspection_status: entry.inspectionStatus,
    http_status: entry.httpStatus,
    final_url: entry.finalUrl,
    redirect_count: entry.redirectCount,
    robots: entry.robots,
    indexable: entry.indexable,
    canonical: entry.canonical,
    title: entry.title,
    meta_description: entry.metaDescription,
    old_email: entry.oldEmail,
    old_domain: entry.oldDomain,
    old_brand: entry.oldBrand,
    add_to_cart: entry.addToCart,
    content_signature: entry.contentSignature,
    duplicate_title_count: entry.duplicateTitleCount,
    duplicate_content_count: entry.duplicateContentCount,
    classification: entry.classification,
    notes: entry.notes,
  }));
  return [columns.join(','), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','))].join('\n');
}

function countTable(title, counts) {
  const lines = [`### ${title}`, '', '| Group | URLs |', '|---|---:|'];
  Object.entries(counts).forEach(([name, count]) => lines.push(`| ${markdownCell(name)} | ${count} |`));
  return lines.join('\n');
}

function findingTable(title, entries, limit = 30) {
  const lines = [
    `### ${title}`,
    '',
    '| URL | Type | Status | Canonical | Classification | Evidence |',
    '|---|---|---:|---|---|---|',
  ];
  if (!entries.length) lines.push('| None | | | | | |');
  entries.slice(0, limit).forEach((entry) => lines.push(
    `| ${markdownCell(entry.url)} | ${markdownCell(entry.urlType)} | ${markdownCell(entry.httpStatus || entry.inspectionStatus)} | ${markdownCell(entry.canonical || 'Not inspected')} | ${markdownCell(entry.classification)} | ${markdownCell(entry.notes || 'Review with GSC')} |`,
  ));
  if (entries.length > limit) lines.push(`\n_${entries.length - limit} additional rows are available in JSON/CSV output._`);
  return lines.join('\n');
}

function toMarkdown(report) {
  const summary = report.summary;
  const legacy = report.entries.filter((entry) => entry.classification === 'legacy/broken');
  const products = report.entries.filter((entry) => entry.classification === 'product review');
  const authors = report.entries.filter((entry) => entry.classification === 'author/taxonomy review');
  const transport = report.entries.filter((entry) => entry.inspectionStatus === 'transport-error');
  const lines = [
    '# Malendo Indexation Inventory',
    '',
    '## Executive Summary',
    '',
    `- Sitemap documents requested: **${summary.sitemapCount}** (${summary.sitemapErrors} errors).`,
    `- Unique sitemap URLs inventoried: **${summary.sitemapUrls}**.`,
    `- Total inventory records including translated host roots: **${summary.inventoriedUrls}**.`,
    `- HTML pages inspected: **${summary.inspectedUrls}**; not sampled: **${summary.uninspectedUrls}**; transport errors: **${summary.transportErrors}**.`,
    `- Translated subdomain roots discovered: **${summary.translatedHosts}**.`,
    `- Duplicate title groups in the inspected sample: **${summary.duplicateTitleGroups}**.`,
    `- Duplicate content-signature groups in the inspected sample: **${summary.duplicateContentGroups}**.`,
    '',
    '> This is an inventory and review classification, not an automatic noindex/delete decision. Join the CSV with a private GSC Pages export before changing indexation.',
    '',
    '## Sitemap Inventory',
    '',
    '| Sitemap | Type | HTTP | URLs | Child sitemaps | Error |',
    '|---|---|---:|---:|---:|---|',
  ];
  report.sitemaps.forEach((sitemap) => lines.push(`| ${markdownCell(sitemap.url)} | ${sitemap.type} | ${sitemap.status || 'ERR'} | ${sitemap.urlCount} | ${sitemap.childSitemapCount} | ${markdownCell(sitemap.error)} |`));
  lines.push(
    '',
    countTable('URL Counts By Type', summary.urlCountsByType),
    '',
    countTable('Review Classifications', summary.classificationCounts),
    '',
    countTable('Inspected HTTP Statuses', summary.statusCounts),
    '',
    '## Translated Hosts',
    '',
    '| Host | HTTP | Final URL | Robots | Canonical | Classification |',
    '|---|---:|---|---|---|---|',
  );
  if (!report.translatedHosts.length) lines.push('| None discovered | | | | | |');
  report.translatedHosts.forEach((host) => lines.push(`| ${host.host} | ${host.httpStatus || 'ERR'} | ${markdownCell(host.finalUrl)} | ${markdownCell(host.robots)} | ${markdownCell(host.canonical)} | duplicate/language review |`));
  lines.push(
    '',
    findingTable('Legacy / Broken Findings', legacy),
    '',
    findingTable('Product Review Sample', products.filter((entry) => entry.inspectionStatus !== 'not-sampled')),
    '',
    findingTable('Author / Taxonomy Review Sample', authors.filter((entry) => entry.inspectionStatus !== 'not-sampled')),
    '',
    '## Duplicate Titles',
    '',
    '| Normalized title | Count | Example URLs |',
    '|---|---:|---|',
  );
  if (!report.duplicateTitles.length) lines.push('| None in inspected sample | 0 | |');
  report.duplicateTitles.slice(0, 30).forEach((group) => lines.push(`| ${markdownCell(group.value)} | ${group.count} | ${markdownCell(group.urls.slice(0, 3).join(' ; '))} |`));
  lines.push(
    '',
    '## Duplicate Content Signatures',
    '',
    '| Signature | Count | Example URLs |',
    '|---|---:|---|',
  );
  if (!report.duplicateContent.length) lines.push('| None in inspected sample | 0 | |');
  report.duplicateContent.slice(0, 30).forEach((group) => lines.push(`| ${group.value} | ${group.count} | ${markdownCell(group.urls.slice(0, 3).join(' ; '))} |`));
  lines.push(
    '',
    '## Transport Limitations',
    '',
    transport.length
      ? transport.map((entry) => `- ${entry.url}: ${entry.transportError}`).join('\n')
      : '- No sampled page transport failures.',
    '',
    '## Safe Decision Workflow',
    '',
    '1. Export the full inventory with `--csv`.',
    '2. Join on the exact `url` / GSC `Page` value.',
    '3. Protect URLs with clicks, leads, or strategic commercial intent.',
    '4. Review product, author/taxonomy, duplicate/language, and legacy buckets manually.',
    '5. Apply any approved indexation changes in WordPress/Yoast, then re-run live QA and this inventory.',
    '',
    '## Safety Notes',
    '',
    '- Do not noindex, delete, redirect, or unpublish from this report alone.',
    '- Do not interpret `not-sampled` as healthy or unhealthy.',
    '- Do not upload or commit private GSC exports.',
    '- Do not use Git to mask WordPress/Yoast indexation settings.',
  );
  return lines.join('\n');
}

function toConsole(report) {
  const summary = report.summary;
  const lines = [
    'Malendo Indexation Inventory',
    '============================',
    `Sitemaps requested: ${summary.sitemapCount} (${summary.sitemapErrors} errors)`,
    `Sitemap URLs: ${summary.sitemapUrls}`,
    `Total records including translated hosts: ${summary.inventoriedUrls}`,
    `Inspected: ${summary.inspectedUrls} | Not sampled: ${summary.uninspectedUrls} | Transport errors: ${summary.transportErrors}`,
    `Translated hosts: ${summary.translatedHosts}`,
    '',
    'URL types:',
    ...Object.entries(summary.urlCountsByType).map(([name, count]) => `  ${name}: ${count}`),
    '',
    'Review classifications:',
    ...Object.entries(summary.classificationCounts).map(([name, count]) => `  ${name}: ${count}`),
    '',
    `Legacy email markers in inspected pages: ${summary.oldEmailCount}`,
    `Legacy domain markers in inspected pages: ${summary.oldDomainCount}`,
    `Add to cart markers in inspected pages: ${summary.addToCartCount}`,
    `Duplicate title groups: ${summary.duplicateTitleGroups}`,
    `Duplicate content groups: ${summary.duplicateContentGroups}`,
    '',
    'This audit is advisory. Export --csv and join with private GSC Pages data before indexation decisions.',
  ];
  return lines.join('\n');
}

async function run() {
  const sitemap = await discoverSitemaps();
  if (!sitemap.sitemaps.length || (sitemap.sitemaps[0]?.status ?? 0) === 0) {
    throw new Error(`Unable to fetch sitemap index: ${sitemap.sitemaps[0]?.error || 'no response'}`);
  }

  const typedEntries = sitemap.entries.map((entry) => ({ ...entry, urlType: inferUrlType(entry.url, entry.sitemapType) }));
  const inspections = await inspectEntries(typedEntries);
  const discoveredLanguages = languageCandidates(typedEntries, inspections);
  const languageHosts = await inspectLanguageHosts(discoveredLanguages, inspections);
  const enriched = enrichEntries(typedEntries, inspections, languageHosts);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    advisoryOnly: true,
    configuration: {
      inspectAll,
      maxInspections: inspectAll ? 'all' : maxInspections,
      maxLanguageHosts: Number.isFinite(maxLanguageHosts) ? maxLanguageHosts : 'all',
      concurrency,
      requestMethod: 'GET',
      credentialsAccepted: false,
    },
    classifications: CLASSIFICATIONS,
    sitemapIndex: sitemap.rootUrl,
    sitemaps: sitemap.sitemaps,
    entries: enriched.entries,
    translatedHosts: enriched.translatedHosts,
    duplicateTitles: enriched.duplicateTitles,
    duplicateContent: enriched.duplicateContent,
  };
  report.summary = summarize(report);

  if (mode === 'json') console.log(JSON.stringify(report, null, 2));
  else if (mode === 'markdown') console.log(toMarkdown(report));
  else if (mode === 'csv') console.log(toCsv(report));
  else console.log(toConsole(report));
}

run().catch((error) => {
  console.error(`Audit runtime failure: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
