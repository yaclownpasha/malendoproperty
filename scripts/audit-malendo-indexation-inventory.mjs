#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const BASE_URL = 'https://malendo-property.com';
const BASE_HOST = new URL(BASE_URL).hostname;
const DEFAULT_MAX_INSPECTIONS = 160;
const DEFAULT_CONCURRENCY = 3;
const REQUEST_TIMEOUT_MS = 20000;
const MAX_REDIRECTS = 6;
const MAX_RETRIES = 2;
const USER_AGENT = 'MalendoIndexationInventory/2.0 (+read-only public SEO audit)';

const CLASSIFICATIONS = [
  'commercial-rent-buy',
  'project-verification',
  'property-management',
  'location-supporting',
  'tourism-general',
  'WooCommerce-product-review',
  'taxonomy-author-review',
  'language-subdomain-review',
  'legacy-broken',
  'manual-GSC-decision',
];

const KNOWN_URL_TYPES = [
  'homepage', 'page', 'properties-hub', 'estate-property', 'rent-landing', 'sell-landing',
  'product', 'product-category', 'author', 'post-blog', 'location-page', 'project-hub',
  'project', 'developer-hub', 'developer', 'available', 'taxonomy-archive',
  'translated-language', 'legacy-demo', 'contact', 'submit-application',
  'property-management', 'unknown',
];

const KNOWN_SITEMAP_TYPES = [
  'page', 'estate', 'product', 'product-category', 'author', 'post', 'location',
  'project', 'developer', 'available', 'taxonomy', 'other',
];

const REST_TYPE_EXCLUSIONS = new Set([
  'attachment', 'revision', 'nav_menu_item', 'wp_block', 'wp_template',
  'wp_template_part', 'wp_navigation', 'wp_font_family', 'wp_font_face',
]);

const SAFE_FLAGS = new Set(['all', 'json', 'markdown', 'csv', 'help']);
const SAFE_VALUES = new Set(['max-urls', 'max-language-hosts', 'max-rest-pages', 'concurrency', 'gsc-pages']);
const SENSITIVE_ARGUMENT = /(?:cookie|password|passwd|token|secret|authorization|credential|api[-_]?key|user(?:name)?)/i;

const args = parseArgs(process.argv.slice(2));
try {
  validateArgs(args);
} catch (error) {
  console.error(`Argument error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

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
const maxRestPages = args.values.has('max-rest-pages')
  ? positiveInteger(args.values.get('max-rest-pages'), Number.POSITIVE_INFINITY)
  : Number.POSITIVE_INFINITY;
const concurrency = Math.min(6, positiveInteger(args.values.get('concurrency'), DEFAULT_CONCURRENCY));
const gscPagesPath = args.values.get('gsc-pages') ?? '';

if (args.flags.has('help')) {
  printUsage();
  process.exit(0);
}

function parseArgs(argv) {
  const parsed = { flags: new Set(), values: new Map(), errors: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) {
      parsed.errors.push(`Unexpected positional argument: ${argument}`);
      continue;
    }
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

function validateArgs(parsed) {
  const errors = [...parsed.errors];
  for (const flag of parsed.flags) {
    if (SENSITIVE_ARGUMENT.test(flag)) errors.push(`Credential/authentication option is not supported: --${flag}`);
    else if (!SAFE_FLAGS.has(flag)) errors.push(`Unknown flag: --${flag}`);
  }
  for (const key of parsed.values.keys()) {
    if (SENSITIVE_ARGUMENT.test(key)) errors.push(`Credential/authentication option is not supported: --${key}`);
    else if (!SAFE_VALUES.has(key)) errors.push(`Unknown option: --${key}`);
  }
  if (parsed.flags.has('gsc-pages')) errors.push('--gsc-pages requires a local CSV path');
  const outputFlags = ['json', 'markdown', 'csv'].filter((flag) => parsed.flags.has(flag));
  if (outputFlags.length > 1) errors.push('Choose only one output mode: --markdown, --json, or --csv');
  if (errors.length) {
    throw new Error(errors.join('\n'));
  }
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
    '  node scripts/audit-malendo-indexation-inventory.mjs --gsc-pages /private/path/gsc-pages.csv --csv',
    '',
    'Inspection controls:',
    `  --max-urls N             Deterministic page sample (default: ${DEFAULT_MAX_INSPECTIONS})`,
    '  --all                    Inspect every discovered URL',
    `  --concurrency N          Concurrent requests, capped at 6 (default: ${DEFAULT_CONCURRENCY})`,
    '  --max-language-hosts N   Limit language-root requests; all discovered hosts remain inventoried',
    '  --max-rest-pages N        Limit pages per public REST type for quick output tests',
    '',
    'The tool performs public GET requests only and does not accept credentials.',
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

function fullTags(html, name) {
  return String(html).match(new RegExp(`<${name}\\b[^>]*>[\\s\\S]*?<\\/${name}>`, 'gi')) ?? [];
}

function absoluteUrl(value, base = BASE_URL) {
  try {
    return new URL(decodeEntities(value), base).href;
  } catch {
    return '';
  }
}

function reportUrl(value, base = BASE_URL) {
  const absolute = absoluteUrl(value, base);
  if (!absolute) return '';
  const url = new URL(absolute);
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  return url.href;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
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

function normalizedPath(pathname) {
  const path = `/${String(pathname ?? '').replace(/^\/+/, '')}`;
  return path !== '/' && !path.endsWith('/') ? `${path}/` : path;
}

function sameSiteFamily(value) {
  try {
    const host = new URL(value).hostname;
    return host === BASE_HOST || host.endsWith(`.${BASE_HOST}`);
  } catch {
    return false;
  }
}

function stableHash(value, length = 20) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, length);
}

function titleSignature(title) {
  const normalized = String(title ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  return normalized ? stableHash(normalized, 16) : '';
}

function contentSignature(text) {
  const normalized = String(text ?? '')
    .toLowerCase()
    .replace(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length >= 120 ? stableHash(normalized) : '';
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

function safeError(error) {
  return String(error instanceof Error ? error.message : error)
    .replace(/https?:\/\/[^\s]+/gi, (url) => reportUrl(url) || '[redacted URL]')
    .replace(/\?[^\s]*/g, '?[redacted]');
}

async function requestText(url, options = {}) {
  const redirects = [];
  let currentUrl = url;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    let response;
    let lastError = '';
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        response = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          credentials: 'omit',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: {
            accept: options.accept ?? 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
            'user-agent': USER_AGENT,
          },
        });
        if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
          await sleep(retryDelay(response, attempt));
          continue;
        }
        break;
      } catch (error) {
        lastError = safeError(error);
        if (attempt < MAX_RETRIES) await sleep(retryDelay(null, attempt));
      }
    }

    if (!response) {
      return {
        requestedUrl: reportUrl(url),
        finalUrl: reportUrl(currentUrl),
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
      redirects.push({
        from: reportUrl(currentUrl),
        status: response.status,
        to: reportUrl(nextUrl),
      });
      if (!nextUrl) break;
      currentUrl = nextUrl;
      continue;
    }

    return {
      requestedUrl: reportUrl(url),
      finalUrl: reportUrl(currentUrl),
      status: response.status,
      redirects,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text(),
      error: '',
    };
  }

  return {
    requestedUrl: reportUrl(url),
    finalUrl: reportUrl(currentUrl),
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
    .map((match) => reportUrl(stripTags(match[1])))
    .filter(Boolean);
}

function xmlUrlEntries(xml) {
  return [...String(xml).matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)].map((match) => {
    const block = match[1];
    const loc = (block.match(/<loc\b[^>]*>([\s\S]*?)<\/loc>/i) ?? [])[1] ?? '';
    const lastmod = (block.match(/<lastmod\b[^>]*>([\s\S]*?)<\/lastmod>/i) ?? [])[1] ?? '';
    return { url: reportUrl(stripTags(loc)), lastmod: stripTags(lastmod) };
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
  if (/location|city|region|state|country|province|neighbou?rhood|street|beach/.test(name)) return 'location';
  if (/post/.test(name)) return 'post';
  if (/page/.test(name)) return 'page';
  if (/categor|tag|taxonomy|property-type|offer-type|rent-type|sell-type|view|floor|filter|features|pets/.test(name)) return 'taxonomy';
  return 'other';
}

async function discoverSitemaps() {
  const rootUrl = `${BASE_URL}/sitemap_index.xml`;
  const queue = [rootUrl];
  const seen = new Set();
  const sitemaps = [];
  const entries = [];

  while (queue.length) {
    const batch = queue.splice(0, concurrency).filter((url) => !seen.has(url));
    batch.forEach((url) => seen.add(url));
    const fetched = await mapLimit(batch, concurrency, async (url) => ({
      url,
      response: await requestText(url, { accept: 'application/xml,text/xml,*/*' }),
    }));

    for (const { url, response } of fetched) {
      const isIndex = /<sitemapindex\b/i.test(response.body);
      const isUrlset = /<urlset\b/i.test(response.body);
      const children = isIndex ? xmlLocations(response.body) : [];
      const urls = isUrlset ? xmlUrlEntries(response.body) : [];
      sitemaps.push({
        url: reportUrl(url),
        type: sitemapType(url),
        status: response.status,
        finalUrl: response.finalUrl,
        childSitemapCount: children.length,
        urlCount: urls.length,
        transportError: response.error,
      });
      children.filter((child) => !seen.has(child)).forEach((child) => queue.push(child));
      urls.forEach((entry) => entries.push({
        ...entry,
        sourceSitemap: reportUrl(url),
        sitemapType: sitemapType(url),
      }));
    }
  }

  return { rootUrl, sitemaps, entries };
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

function canonicalOf(html, base) {
  for (const tag of tags(html, 'link')) {
    const rel = attribute(tag, 'rel').toLowerCase().split(/\s+/);
    if (rel.includes('canonical')) return reportUrl(attribute(tag, 'href'), base);
  }
  return '';
}

function h1sOf(html) {
  return [...String(html).matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean);
}

function bodyTextOf(html) {
  const body = (String(html).match(/<body\b[^>]*>([\s\S]*?)<\/body>/i) ?? [])[1] ?? html;
  return stripTags(body);
}

function linksOf(html, base) {
  const links = [];
  for (const tag of tags(html, 'a')) {
    const href = attribute(tag, 'href');
    if (!href || /^(?:mailto|tel|javascript|data):/i.test(href) || href.startsWith('#')) continue;
    const url = reportUrl(href, base);
    if (url) links.push(url);
  }
  return unique(links);
}

function navigationLinksOf(html, base) {
  const regions = [
    ...fullTags(html, 'header'),
    ...fullTags(html, 'nav'),
  ];
  return unique(regions.flatMap((region) => linksOf(region, base)));
}

function hreflangOf(html, base) {
  return uniqueObjects(tags(html, 'link').map((tag) => ({
    rel: attribute(tag, 'rel').toLowerCase(),
    language: attribute(tag, 'hreflang').toLowerCase(),
    url: reportUrl(attribute(tag, 'href'), base),
  })).filter((entry) => (
    entry.rel.split(/\s+/).includes('alternate')
    && entry.language
    && entry.url
  )), (entry) => `${entry.language}|${entry.url}`);
}

function documentLanguage(html) {
  const htmlTag = (String(html).match(/<html\b[^>]*>/i) ?? [])[0] ?? '';
  return attribute(htmlTag, 'lang').toLowerCase();
}

function legacyMarkers(html) {
  const withoutOfficialSocials = String(html)
    .replace(/https?:\/\/(?:www\.)?instagram\.com\/malendo\.property\/?/gi, '')
    .replace(/https?:\/\/(?:www\.)?facebook\.com\/Malendo\.Property\/?/gi, '');
  return {
    oldEmail: /info@malendo\.property/i.test(withoutOfficialSocials),
    currentEmail: /info@malendo-property\.com/i.test(withoutOfficialSocials),
    oldDomain: /(?:https?:)?\/\/malendo\.property(?:\/|["'?#\s<]|$)/i.test(withoutOfficialSocials),
    oldBrand: /Malendo\.property/i.test(withoutOfficialSocials),
  };
}

function wooCommerceMarker(html) {
  return (
    /(?:single_add_to_cart_button|name\s*=\s*['"]add-to-cart|class\s*=\s*['"][^'"]*\badd_to_cart_button\b|\?add-to-cart=\d+)/i.test(html)
    || /<body\b[^>]*class\s*=\s*['"][^'"]*\b(?:single-product|post-type-archive-product|tax-product_cat)\b/i.test(html)
  );
}

function archiveMarker(html, urlType) {
  return ['author', 'taxonomy-archive', 'available', 'product-category'].includes(urlType)
    || /(?:\bbody[^>]+class\s*=\s*['"][^'"]*\b(?:archive|author|tax-)|\bcategory\b|\btaxonomy\b)/i.test(html);
}

function inferUrlType(input, sourceType = '', restType = '') {
  let url;
  try {
    url = new URL(input);
  } catch {
    return 'unknown';
  }
  const path = normalizedPath(url.pathname).toLowerCase();
  if (url.hostname !== BASE_HOST) return 'translated-language';
  if (path === '/') return 'homepage';
  if (path === '/properties/') return 'properties-hub';
  if (path === '/contact/') return 'contact';
  if (path === '/submit-your-application/') return 'submit-application';
  if (path.includes('/services/property-management/')) return 'property-management';
  if (path.startsWith('/request-phuket-project-check/') || path.includes('project-check-methodology')) return 'project';
  if (path.startsWith('/product-category/') || sourceType === 'product-category') return 'product-category';
  if (path.startsWith('/product/') || sourceType === 'product' || restType === 'product') return 'product';
  if (path.startsWith('/author/') || path.startsWith('/user/') || sourceType === 'author') return 'author';
  if (path.startsWith('/projects/') || sourceType === 'project') return path === '/projects/' ? 'project-hub' : 'project';
  if (path.startsWith('/developers/') || sourceType === 'developer') return path === '/developers/' ? 'developer-hub' : 'developer';
  if (path.startsWith('/properties/') || sourceType === 'estate' || restType === 'estate') return 'estate-property';
  if (path.startsWith('/rent-property/')) return 'rent-landing';
  if (path.startsWith('/sell-property/')) return 'sell-landing';
  if (path.startsWith('/available/') || sourceType === 'available') return 'available';
  if (sourceType === 'location' || /\/(thailand|phuket|patong|kata|karon|kamala|rawai|bang-tao|bangtao)\//.test(path)) return 'location-page';
  if (sourceType === 'post' || restType === 'post' || /^\/\d{4}\/\d{2}\//.test(path) || path.startsWith('/blog/')) return 'post-blog';
  if (sourceType === 'taxonomy' || path.startsWith('/category/') || path.startsWith('/tag/')) return 'taxonomy-archive';
  if (/\/(test(?:-\d+)?|about-me-2|advanced-search-form|video-fullscreen-buttons)\/$/.test(path)) return 'legacy-demo';
  if (sourceType === 'page' || restType === 'page') return 'page';
  return 'unknown';
}

function inferWpObjectType(record) {
  if (record.restType) return record.restType;
  const map = {
    homepage: 'page',
    page: 'page',
    'properties-hub': 'page/archive',
    'estate-property': 'estate',
    'rent-landing': 'page/taxonomy',
    'sell-landing': 'page/taxonomy',
    product: 'product',
    'product-category': 'product_cat taxonomy',
    author: 'author archive',
    'post-blog': 'post',
    'location-page': 'location taxonomy/page',
    'project-hub': 'page',
    project: 'page/project editorial',
    'developer-hub': 'page',
    developer: 'page/developer editorial',
    available: 'available taxonomy',
    'taxonomy-archive': 'taxonomy archive',
    contact: 'page',
    'submit-application': 'page',
    'property-management': 'page',
    'translated-language': 'translated page',
  };
  return map[record.urlType] ?? 'unknown';
}

function inspectHtml(response, urlType) {
  const html = response.body;
  const markers = legacyMarkers(html);
  const robots = unique([
    metaOf(html, 'robots'),
    response.headers['x-robots-tag'] ?? '',
  ]).join(', ');
  const h1s = h1sOf(html);
  const bodyText = bodyTextOf(html);
  const internalOutlinks = linksOf(html, response.finalUrl).filter(sameSiteFamily);
  const title = titleOf(html);
  return {
    inspectionStatus: response.error ? 'transport-error' : 'inspected',
    httpStatus: response.status,
    finalUrl: response.finalUrl,
    redirectChain: response.redirects,
    redirectCount: response.redirects.length,
    contentType: response.headers['content-type'] ?? '',
    robots,
    indexable: response.status === 200 && !/\bnoindex\b/i.test(robots),
    canonical: canonicalOf(html, response.finalUrl),
    title,
    metaDescription: metaOf(html, 'description'),
    h1Count: h1s.length,
    firstH1: h1s[0] ?? '',
    language: documentLanguage(html),
    hreflang: hreflangOf(html, response.finalUrl),
    oldEmail: markers.oldEmail,
    currentEmail: markers.currentEmail,
    oldDomain: markers.oldDomain,
    oldBrand: markers.oldBrand,
    wooCommerceProductMarker: wooCommerceMarker(html),
    authorArchiveTaxonomyMarker: archiveMarker(html, urlType),
    duplicateTitleSignature: titleSignature(title),
    duplicateContentSignature: contentSignature(bodyText),
    contentWordCount: bodyText ? bodyText.split(/\s+/).length : 0,
    internalOutlinks,
    transportError: response.error,
  };
}

function emptyInspection() {
  return {
    inspectionStatus: 'not-sampled',
    httpStatus: '',
    finalUrl: '',
    redirectChain: [],
    redirectCount: '',
    contentType: '',
    robots: '',
    indexable: '',
    canonical: '',
    title: '',
    metaDescription: '',
    h1Count: '',
    firstH1: '',
    language: '',
    hreflang: [],
    oldEmail: '',
    currentEmail: '',
    oldDomain: '',
    oldBrand: '',
    wooCommerceProductMarker: '',
    authorArchiveTaxonomyMarker: '',
    duplicateTitleSignature: '',
    duplicateContentSignature: '',
    contentWordCount: '',
    internalOutlinks: [],
    transportError: '',
  };
}

function createRecord(url) {
  return {
    url,
    sourceSitemaps: new Set(),
    discoverySources: new Set(),
    lastmod: '',
    sitemapType: '',
    restType: '',
    wpObjectId: '',
    wpParentId: '',
  };
}

function mergeRecord(records, rawUrl, details = {}) {
  const url = reportUrl(rawUrl);
  if (!url || !sameSiteFamily(url)) return null;
  if (!records.has(url)) records.set(url, createRecord(url));
  const record = records.get(url);
  if (details.sourceSitemap) record.sourceSitemaps.add(reportUrl(details.sourceSitemap));
  if (details.discoverySource) record.discoverySources.add(details.discoverySource);
  if (details.lastmod && !record.lastmod) record.lastmod = details.lastmod;
  if (details.sitemapType && !record.sitemapType) record.sitemapType = details.sitemapType;
  if (details.restType) record.restType = details.restType;
  if (details.wpObjectId) record.wpObjectId = details.wpObjectId;
  if (details.wpParentId !== undefined && details.wpParentId !== '') record.wpParentId = details.wpParentId;
  return record;
}

async function discoverHomepage() {
  const response = await requestText(`${BASE_URL}/`);
  const inspection = inspectHtml(response, 'homepage');
  return {
    response,
    inspection,
    allLinks: linksOf(response.body, response.finalUrl).filter(sameSiteFamily),
    navigationLinks: navigationLinksOf(response.body, response.finalUrl).filter(sameSiteFamily),
    hreflang: inspection.hreflang,
  };
}

async function discoverRestObjects() {
  const diagnostics = [];
  const objects = [];
  const typesResponse = await requestText(`${BASE_URL}/wp-json/wp/v2/types`, { accept: 'application/json' });
  if (typesResponse.error || typesResponse.status !== 200) {
    diagnostics.push({
      endpoint: `${BASE_URL}/wp-json/wp/v2/types`,
      status: typesResponse.status,
      transportError: typesResponse.error,
      note: 'Public REST type discovery unavailable',
    });
    return { objects, diagnostics };
  }

  let payload;
  try {
    payload = JSON.parse(typesResponse.body);
  } catch {
    diagnostics.push({
      endpoint: `${BASE_URL}/wp-json/wp/v2/types`,
      status: typesResponse.status,
      transportError: '',
      note: 'Public REST type response was not valid JSON',
    });
    return { objects, diagnostics };
  }

  const types = Object.values(payload).filter((type) => (
    type
    && typeof type === 'object'
    && type.rest_base
    && type.viewable !== false
    && !REST_TYPE_EXCLUSIONS.has(type.slug)
    && !REST_TYPE_EXCLUSIONS.has(type.rest_base)
  ));

  for (const type of types) {
    const endpoint = `${BASE_URL}/wp-json/wp/v2/${encodeURIComponent(type.rest_base)}`;
    let found = 0;
    let lastStatus = 200;
    let transportError = '';

    const firstResponse = await requestText(
      `${endpoint}?per_page=100&page=1&_fields=id,link,type,status,slug,parent`,
      { accept: 'application/json' },
    );
    lastStatus = firstResponse.status;
    transportError = firstResponse.error;
    let totalPages = Math.min(
      1000,
      positiveInteger(firstResponse.headers['x-wp-totalpages'], 1),
      maxRestPages,
    );
    const pageResults = [{ page: 1, response: firstResponse }];
    if (!firstResponse.error && firstResponse.status === 200 && totalPages > 1) {
      const remainingPages = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);
      const remaining = await mapLimit(remainingPages, concurrency, async (page) => ({
        page,
        response: await requestText(
          `${endpoint}?per_page=100&page=${page}&_fields=id,link,type,status,slug,parent`,
          { accept: 'application/json' },
        ),
      }));
      pageResults.push(...remaining);
    }

    for (const { response } of pageResults) {
      if (response.error || response.status !== 200) {
        lastStatus = response.status;
        transportError = response.error || `HTTP ${response.status}`;
        continue;
      }
      try {
        const rows = JSON.parse(response.body);
        if (!Array.isArray(rows)) continue;
        for (const row of rows) {
          const url = reportUrl(row.link);
          if (!url || !sameSiteFamily(url)) continue;
          objects.push({
            url,
            restType: String(row.type || type.slug || ''),
            wpObjectId: row.id ?? '',
            wpParentId: row.parent ?? '',
          });
          found += 1;
        }
      } catch {
        transportError = 'REST response was not valid JSON';
      }
    }

    diagnostics.push({
      endpoint: reportUrl(endpoint),
      objectType: type.slug || type.rest_base,
      status: lastStatus,
      pagesRequested: pageResults.length,
      objectsFound: found,
      transportError,
      note: lastStatus === 200 ? '' : 'REST collection unavailable or restricted',
    });
  }

  return { objects, diagnostics };
}

function deterministicSample(records, maximum) {
  if (!Number.isFinite(maximum) || records.length <= maximum) return records;
  const groups = new Map();
  for (const record of records) {
    if (!groups.has(record.urlType)) groups.set(record.urlType, []);
    groups.get(record.urlType).push(record);
  }
  for (const values of groups.values()) values.sort((a, b) => stableHash(a.url).localeCompare(stableHash(b.url)));
  const selected = [];
  const names = [...groups.keys()].sort();
  let round = 0;
  while (selected.length < maximum) {
    let added = false;
    for (const name of names) {
      const candidate = groups.get(name)[round];
      if (!candidate) continue;
      selected.push(candidate);
      added = true;
      if (selected.length === maximum) break;
    }
    if (!added) break;
    round += 1;
  }
  const homepage = records.find((record) => record.url === `${BASE_URL}/`);
  if (homepage && !selected.includes(homepage)) selected[selected.length - 1] = homepage;
  return uniqueObjects(selected, (record) => record.url);
}

async function inspectRecords(records, seedInspections) {
  const sample = deterministicSample(records, maxInspections);
  const pending = sample.filter((record) => !seedInspections.has(record.url));
  const results = await mapLimit(pending, concurrency, async (record) => {
    const response = await requestText(record.url);
    return [record.url, inspectHtml(response, record.urlType)];
  });
  return new Map([...seedInspections, ...results]);
}

function addLanguageRoots(records) {
  const hosts = unique([...records.values()]
    .map((record) => new URL(record.url).hostname)
    .filter((host) => host !== BASE_HOST && host.endsWith(`.${BASE_HOST}`)))
    .sort();
  hosts.forEach((host) => mergeRecord(records, `https://${host}/`, { discoverySource: 'language-host-root' }));
  return hosts;
}

async function inspectLanguageRoots(records, inspections, languageHosts) {
  const roots = languageHosts.map((host) => `https://${host}/`);
  const selected = Number.isFinite(maxLanguageHosts) ? roots.slice(0, maxLanguageHosts) : roots;
  const pending = selected.filter((url) => !inspections.has(url));
  const results = await mapLimit(pending, Math.min(concurrency, 2), async (url) => {
    const record = records.get(url);
    const response = await requestText(url);
    return [url, inspectHtml(response, record?.urlType ?? 'translated-language')];
  });
  results.forEach(([url, inspection]) => inspections.set(url, inspection));
}

function addRedirectAndOutlinkDiscoveries(records, inspections) {
  const additions = [];
  for (const [sourceUrl, inspection] of inspections.entries()) {
    for (const redirect of inspection.redirectChain) {
      additions.push([redirect.to, { discoverySource: `redirect-from:${sourceUrl}` }]);
    }
    if (inspection.finalUrl && inspection.finalUrl !== sourceUrl) {
      additions.push([inspection.finalUrl, { discoverySource: `final-url-from:${sourceUrl}` }]);
      if (!inspections.has(inspection.finalUrl)) inspections.set(inspection.finalUrl, inspection);
    }
    for (const outlink of inspection.internalOutlinks) {
      additions.push([outlink, { discoverySource: `internal-link-from:${sourceUrl}` }]);
    }
  }
  additions.forEach(([url, details]) => mergeRecord(records, url, details));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function normalizedHeader(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pickColumn(row, names) {
  const keys = Object.keys(row);
  for (const name of names) {
    const match = keys.find((key) => normalizedHeader(key) === normalizedHeader(name));
    if (match) return row[match];
  }
  return '';
}

function numberValue(value) {
  const cleaned = String(value ?? '').trim().replace(/%$/, '').replace(/,/g, '');
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function readGscPages(filePath) {
  if (!filePath) return { supplied: false, rowsRead: 0, metrics: new Map(), warnings: [] };
  const raw = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const parsed = parseCsv(raw).filter((row) => row.some((cell) => String(cell).trim()));
  if (parsed.length < 2) throw new Error('The supplied GSC Pages CSV has no data rows');
  const headers = parsed[0].map((header) => header.trim());
  const metrics = new Map();
  let rowsRead = 0;
  for (const cells of parsed.slice(1)) {
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
    const url = reportUrl(pickColumn(row, ['Page', 'Top pages', 'URL']));
    if (!url) continue;
    const clicks = numberValue(pickColumn(row, ['Clicks']));
    const impressions = numberValue(pickColumn(row, ['Impressions']));
    const ctrRaw = pickColumn(row, ['CTR']);
    const ctr = ctrRaw === '' ? (impressions ? (clicks / impressions) * 100 : 0) : numberValue(ctrRaw);
    const position = numberValue(pickColumn(row, ['Position', 'Average position', 'Avg position']));
    const existing = metrics.get(url) ?? { clicks: 0, impressions: 0, weightedPosition: 0 };
    existing.clicks += clicks;
    existing.impressions += impressions;
    existing.weightedPosition += position * Math.max(impressions, 1);
    metrics.set(url, existing);
    rowsRead += 1;
  }
  for (const metric of metrics.values()) {
    metric.ctr = metric.impressions ? (metric.clicks / metric.impressions) * 100 : 0;
    metric.position = metric.weightedPosition / Math.max(metric.impressions, 1);
    delete metric.weightedPosition;
  }
  return {
    supplied: true,
    rowsRead,
    metrics,
    warnings: ['GSC file path and non-URL private data are never included in output'],
  };
}

function groupCounts(items, keyFn, knownValues = []) {
  const counts = new Map(knownValues.map((value) => [value, 0]));
  for (const item of items) {
    const key = keyFn(item) || 'unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function duplicateGroups(records, signatureField) {
  const groups = new Map();
  for (const record of records) {
    const signature = record[signatureField];
    if (!signature) continue;
    if (!groups.has(signature)) groups.set(signature, []);
    groups.get(signature).push(record.url);
  }
  return [...groups.entries()]
    .filter(([, urls]) => urls.length > 1)
    .map(([signature, urls]) => ({ signature, count: urls.length, urls: urls.sort() }))
    .sort((a, b) => b.count - a.count || a.signature.localeCompare(b.signature));
}

function classify(record) {
  if (
    (record.httpStatus && Number(record.httpStatus) >= 400)
    || record.oldEmail === true
    || record.oldDomain === true
    || record.urlType === 'legacy-demo'
  ) return 'legacy-broken';
  if (record.urlType === 'translated-language') return 'language-subdomain-review';
  if (['project', 'project-hub', 'developer', 'developer-hub'].includes(record.urlType)) return 'project-verification';
  if (record.urlType === 'property-management') return 'property-management';
  if (['product', 'product-category'].includes(record.urlType)) return 'WooCommerce-product-review';
  if (record.authorArchiveTaxonomyMarker === true || ['author', 'taxonomy-archive', 'available'].includes(record.urlType)) return 'taxonomy-author-review';
  if (['homepage', 'properties-hub', 'estate-property', 'rent-landing', 'sell-landing', 'contact', 'submit-application'].includes(record.urlType)) return 'commercial-rent-buy';
  if (record.urlType === 'location-page') return 'location-supporting';
  if (record.urlType === 'post-blog') return 'tourism-general';
  return 'manual-GSC-decision';
}

function normalizeRecords(records, inspections, gsc) {
  const normalized = [...records.values()].map((record) => {
    const url = new URL(record.url);
    const urlType = inferUrlType(record.url, record.sitemapType, record.restType);
    const inspection = inspections.get(record.url) ?? emptyInspection();
    const gscMetric = gsc.metrics.get(record.url) ?? null;
    return {
      url: record.url,
      sourceSitemaps: [...record.sourceSitemaps].sort(),
      discoverySources: [...record.discoverySources].sort(),
      lastmod: record.lastmod,
      sitemapType: record.sitemapType,
      host: url.hostname,
      urlType,
      inferredWpObjectType: inferWpObjectType({ ...record, urlType }),
      restType: record.restType,
      wpObjectId: record.wpObjectId,
      wpParentId: record.wpParentId,
      ...inspection,
      internalInlinks: [],
      internalInlinkCount: 0,
      internalOutlinkCount: inspection.internalOutlinks.length,
      orphanCandidateStatus: 'unknown-partial-crawl',
      duplicateTitleCount: 0,
      duplicateContentCount: 0,
      gscClicks: gscMetric?.clicks ?? '',
      gscImpressions: gscMetric?.impressions ?? '',
      gscCtr: gscMetric?.ctr ?? '',
      gscPosition: gscMetric?.position ?? '',
      classification: '',
      notes: '',
    };
  });

  const byUrl = new Map(normalized.map((record) => [record.url, record]));
  for (const source of normalized) {
    for (const targetUrl of source.internalOutlinks) {
      const target = byUrl.get(targetUrl);
      if (target && !target.internalInlinks.includes(source.url)) target.internalInlinks.push(source.url);
    }
  }

  const fullyInspected = normalized.every((record) => record.inspectionStatus === 'inspected');
  for (const record of normalized) {
    record.internalInlinks.sort();
    record.internalInlinkCount = record.internalInlinks.length;
    if (record.url === `${BASE_URL}/`) record.orphanCandidateStatus = 'excluded-homepage';
    else if (record.urlType === 'translated-language') record.orphanCandidateStatus = 'not-evaluated-language-host';
    else if (record.internalInlinkCount > 0) record.orphanCandidateStatus = 'not-orphan-observed';
    else if (fullyInspected) record.orphanCandidateStatus = 'orphan-candidate';
    else if (record.inspectionStatus === 'not-sampled') record.orphanCandidateStatus = 'unknown-not-inspected';
    else record.orphanCandidateStatus = 'possible-orphan-partial-crawl';
  }

  const duplicateTitles = duplicateGroups(normalized, 'duplicateTitleSignature');
  const duplicateContent = duplicateGroups(normalized, 'duplicateContentSignature');
  const titleCounts = new Map(duplicateTitles.flatMap((group) => group.urls.map((url) => [url, group.count])));
  const contentCounts = new Map(duplicateContent.flatMap((group) => group.urls.map((url) => [url, group.count])));

  for (const record of normalized) {
    record.duplicateTitleCount = titleCounts.get(record.url) ?? 0;
    record.duplicateContentCount = contentCounts.get(record.url) ?? 0;
    record.classification = classify(record);
    const notes = [];
    if (record.inspectionStatus === 'not-sampled') notes.push('HTML not sampled');
    if (record.inspectionStatus === 'transport-error') notes.push(`Transport failure: ${record.transportError}`);
    if (record.canonical && record.canonical !== record.url) notes.push('Canonical differs from inventoried URL');
    if (record.oldEmail) notes.push('Legacy email marker');
    if (record.oldDomain) notes.push('Legacy domain marker');
    if (record.currentEmail) notes.push('Current email marker');
    if (record.wooCommerceProductMarker) notes.push('WooCommerce/Add to cart marker');
    if (record.duplicateTitleCount > 1) notes.push(`Duplicate title group: ${record.duplicateTitleCount}`);
    if (record.duplicateContentCount > 1) notes.push(`Duplicate content group: ${record.duplicateContentCount}`);
    if (record.orphanCandidateStatus.includes('candidate')) notes.push(`Orphan status: ${record.orphanCandidateStatus}`);
    record.notes = notes.join('; ');
  }

  return { records: normalized.sort((a, b) => a.url.localeCompare(b.url)), duplicateTitles, duplicateContent };
}

function summarize(report) {
  const inspected = report.records.filter((record) => record.inspectionStatus === 'inspected');
  const transportFailures = report.records.filter((record) => record.inspectionStatus === 'transport-error');
  return {
    sitemapDocuments: report.sitemaps.length,
    sitemapErrors: report.sitemaps.filter((item) => item.status !== 200 || item.transportError).length,
    totalUrls: report.records.length,
    inspectedUrls: inspected.length,
    uninspectedUrls: report.records.filter((record) => record.inspectionStatus === 'not-sampled').length,
    transportFailures: transportFailures.length,
    urlCountsByType: groupCounts(report.records, (record) => record.urlType, KNOWN_URL_TYPES),
    urlCountsBySitemapType: groupCounts(report.records, (record) => record.sitemapType || 'none', [...KNOWN_SITEMAP_TYPES, 'none']),
    classificationCounts: groupCounts(report.records, (record) => record.classification, CLASSIFICATIONS),
    statusCodeDistribution: groupCounts(
      report.records.filter((record) => record.httpStatus !== ''),
      (record) => String(record.httpStatus),
    ),
    discoverySourceCounts: groupCounts(
      report.records.flatMap((record) => record.discoverySources.map((source) => ({ source: source.split(':')[0] }))),
      (item) => item.source,
    ),
    duplicateTitleGroups: report.duplicateTitles.length,
    duplicateContentGroups: report.duplicateContent.length,
    orphanCandidates: report.records.filter((record) => record.orphanCandidateStatus === 'orphan-candidate').length,
    possibleOrphansPartial: report.records.filter((record) => record.orphanCandidateStatus === 'possible-orphan-partial-crawl').length,
    oldEmailMarkers: inspected.filter((record) => record.oldEmail).length,
    oldDomainMarkers: inspected.filter((record) => record.oldDomain).length,
    currentEmailMarkers: inspected.filter((record) => record.currentEmail).length,
    wooCommerceMarkers: inspected.filter((record) => record.wooCommerceProductMarker).length,
    gscMatchedUrls: report.records.filter((record) => record.gscClicks !== '').length,
  };
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(' | ') : String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function redirectSummary(chain) {
  return chain.map((item) => `${item.status}:${item.from}->${item.to}`).join(' | ');
}

function toCsv(report) {
  const columns = [
    'url', 'source_sitemaps', 'discovery_sources', 'final_url', 'redirect_chain', 'http_status',
    'host', 'content_type', 'inferred_wp_object_type', 'rest_type', 'wp_object_id', 'wp_parent_id',
    'title', 'meta_description', 'h1_count', 'first_h1', 'robots', 'canonical', 'language',
    'hreflang', 'old_domain', 'old_email', 'current_email', 'woocommerce_product_marker',
    'author_archive_taxonomy_marker', 'duplicate_title_signature', 'duplicate_content_signature',
    'duplicate_title_count', 'duplicate_content_count', 'internal_inlink_count', 'internal_inlinks',
    'internal_outlink_count', 'internal_outlinks', 'orphan_candidate_status', 'url_type',
    'classification', 'inspection_status', 'transport_error', 'gsc_clicks', 'gsc_impressions',
    'gsc_ctr', 'gsc_position', 'lastmod', 'notes',
  ];
  const rows = report.records.map((record) => ({
    url: record.url,
    source_sitemaps: record.sourceSitemaps,
    discovery_sources: record.discoverySources,
    final_url: record.finalUrl,
    redirect_chain: redirectSummary(record.redirectChain),
    http_status: record.httpStatus,
    host: record.host,
    content_type: record.contentType,
    inferred_wp_object_type: record.inferredWpObjectType,
    rest_type: record.restType,
    wp_object_id: record.wpObjectId,
    wp_parent_id: record.wpParentId,
    title: record.title,
    meta_description: record.metaDescription,
    h1_count: record.h1Count,
    first_h1: record.firstH1,
    robots: record.robots,
    canonical: record.canonical,
    language: record.language,
    hreflang: record.hreflang.map((item) => `${item.language}:${item.url}`),
    old_domain: record.oldDomain,
    old_email: record.oldEmail,
    current_email: record.currentEmail,
    woocommerce_product_marker: record.wooCommerceProductMarker,
    author_archive_taxonomy_marker: record.authorArchiveTaxonomyMarker,
    duplicate_title_signature: record.duplicateTitleSignature,
    duplicate_content_signature: record.duplicateContentSignature,
    duplicate_title_count: record.duplicateTitleCount,
    duplicate_content_count: record.duplicateContentCount,
    internal_inlink_count: record.internalInlinkCount,
    internal_inlinks: record.internalInlinks,
    internal_outlink_count: record.internalOutlinkCount,
    internal_outlinks: record.internalOutlinks,
    orphan_candidate_status: record.orphanCandidateStatus,
    url_type: record.urlType,
    classification: record.classification,
    inspection_status: record.inspectionStatus,
    transport_error: record.transportError,
    gsc_clicks: record.gscClicks,
    gsc_impressions: record.gscImpressions,
    gsc_ctr: record.gscCtr,
    gsc_position: record.gscPosition,
    lastmod: record.lastmod,
    notes: record.notes,
  }));
  return [columns.join(','), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','))].join('\n');
}

function countTable(title, counts) {
  const lines = [`### ${title}`, '', '| Group | URLs |', '|---|---:|'];
  Object.entries(counts).forEach(([name, count]) => lines.push(`| ${markdownCell(name)} | ${count} |`));
  return lines.join('\n');
}

function duplicateTable(title, groups) {
  const lines = [title, '', '| Signature | Count | Example URLs |', '|---|---:|---|'];
  if (!groups.length) lines.push('| None in inspected set | 0 | |');
  groups.slice(0, 30).forEach((group) => {
    lines.push(`| ${group.signature} | ${group.count} | ${markdownCell(group.urls.slice(0, 4).join(' ; '))} |`);
  });
  if (groups.length > 30) lines.push(`\n_${groups.length - 30} additional groups are available in JSON/CSV._`);
  return lines.join('\n');
}

function toMarkdown(report) {
  const summary = report.summary;
  const transportFailures = report.records.filter((record) => record.inspectionStatus === 'transport-error');
  const possibleOrphans = report.records.filter((record) => record.orphanCandidateStatus.includes('orphan'));
  const legacy = report.records.filter((record) => record.classification === 'legacy-broken');
  const lines = [
    '# Malendo Indexation And Content Inventory',
    '',
    '## Executive Summary',
    '',
    `- Public sitemap documents requested: **${summary.sitemapDocuments}** (${summary.sitemapErrors} sitemap errors).`,
    `- Unique URLs inventoried from sitemaps, homepage/navigation, public REST, language roots, internal links, and redirects: **${summary.totalUrls}**.`,
    `- HTML records inspected: **${summary.inspectedUrls}**; not sampled: **${summary.uninspectedUrls}**.`,
    `- Transport failures: **${summary.transportFailures}**. These are reported separately and are not SEO classifications.`,
    `- Duplicate title groups: **${summary.duplicateTitleGroups}**; duplicate content-signature groups: **${summary.duplicateContentGroups}**.`,
    `- Local GSC Pages CSV supplied: **${report.gsc.supplied ? 'yes' : 'no'}**; matched URLs: **${summary.gscMatchedUrls}**.`,
    '',
    '> Classifications are conservative review buckets. They are not instructions to delete, redirect, noindex, or unpublish.',
    '',
    '## Discovery',
    '',
    '| Source | Evidence |',
    '|---|---|',
    `| Sitemap index | ${markdownCell(report.sitemapIndex)} |`,
    `| Child sitemap attempts | ${Math.max(report.sitemaps.length - 1, 0)} |`,
    `| Homepage links | ${report.discovery.homepageLinkCount} total; ${report.discovery.navigationLinkCount} navigation/header |`,
    `| Public REST objects | ${report.discovery.restObjectCount} |`,
    `| Language hosts | ${report.discovery.languageHostCount} |`,
    '',
    countTable('URL Counts By Classification', summary.classificationCounts),
    '',
    countTable('HTTP Status Distribution', summary.statusCodeDistribution),
    '',
    countTable('URL Counts By Type', summary.urlCountsByType),
    '',
    '## Sitemap Inventory',
    '',
    '| Sitemap | Type | HTTP | URLs | Children | Transport error |',
    '|---|---|---:|---:|---:|---|',
  ];
  report.sitemaps.forEach((sitemap) => {
    lines.push(`| ${markdownCell(sitemap.url)} | ${sitemap.type} | ${sitemap.status || 'ERR'} | ${sitemap.urlCount} | ${sitemap.childSitemapCount} | ${markdownCell(sitemap.transportError)} |`);
  });
  lines.push(
    '',
    duplicateTable('## Duplicate Title Candidates', report.duplicateTitles),
    '',
    duplicateTable('## Duplicate Content Candidates', report.duplicateContent),
    '',
    '## Legacy / Broken Review',
    '',
    '| URL | HTTP | Evidence |',
    '|---|---:|---|',
  );
  if (!legacy.length) lines.push('| None in inspected set | | |');
  legacy.slice(0, 40).forEach((record) => lines.push(`| ${markdownCell(record.url)} | ${record.httpStatus || record.inspectionStatus} | ${markdownCell(record.notes)} |`));
  lines.push(
    '',
    '## Orphan Candidate Review',
    '',
    '| URL | Status | Inlinks observed |',
    '|---|---|---:|',
  );
  if (!possibleOrphans.length) lines.push('| None | | |');
  possibleOrphans.slice(0, 40).forEach((record) => lines.push(`| ${markdownCell(record.url)} | ${record.orphanCandidateStatus} | ${record.internalInlinkCount} |`));
  lines.push(
    '',
    'Partial inspection never produces a definitive orphan finding. `possible-orphan-partial-crawl` requires a complete crawl and GSC review before action.',
    '',
    '## Transport Limitations',
    '',
  );
  if (!transportFailures.length) lines.push('- No page transport failures in the inspected set.');
  else transportFailures.forEach((record) => lines.push(`- ${record.url}: ${record.transportError}`));
  report.discovery.restDiagnostics.filter((item) => item.transportError || item.status !== 200).forEach((item) => {
    lines.push(`- REST ${item.endpoint}: HTTP ${item.status || 'ERR'}; ${item.transportError || item.note}`);
  });
  lines.push(
    '',
    '## Local GSC Join',
    '',
    report.gsc.supplied
      ? `- Local Pages CSV read successfully: ${report.gsc.rowsRead} URL-level rows; ${summary.gscMatchedUrls} inventory matches.`
      : '- No GSC CSV supplied. Use `--gsc-pages /private/path/gsc-pages.csv` for an optional local join.',
    '- Only URL-level clicks, impressions, CTR, and position are joined.',
    '- The local file path and non-URL private data are not printed.',
    '',
    '## Safety Notes',
    '',
    '- Do not delete, noindex, redirect, or unpublish from this inventory alone.',
    '- Check private GSC data and lead value before any indexation decision.',
    '- Query strings are removed from reported URLs.',
    '- Transport failures remain separate from SEO classifications.',
    '- No credentials, cookies, tokens, or form submissions are supported.',
    '- Unsampled records are not treated as passing SEO checks.',
  );
  return lines.join('\n');
}

function toConsole(report) {
  const summary = report.summary;
  return [
    'Malendo Indexation And Content Inventory',
    '========================================',
    `Sitemap documents: ${summary.sitemapDocuments} (${summary.sitemapErrors} errors)`,
    `Unique URLs: ${summary.totalUrls}`,
    `Inspected: ${summary.inspectedUrls} | Not sampled: ${summary.uninspectedUrls}`,
    `Transport failures: ${summary.transportFailures}`,
    '',
    'Classification counts:',
    ...Object.entries(summary.classificationCounts).map(([name, count]) => `  ${name}: ${count}`),
    '',
    'HTTP status distribution:',
    ...Object.entries(summary.statusCodeDistribution).map(([status, count]) => `  ${status}: ${count}`),
    '',
    `Duplicate title groups: ${summary.duplicateTitleGroups}`,
    `Duplicate content groups: ${summary.duplicateContentGroups}`,
    `Possible partial-crawl orphans: ${summary.possibleOrphansPartial}`,
    `GSC matched URLs: ${summary.gscMatchedUrls}`,
    '',
    'Advisory only: classifications are not automatic noindex/delete instructions.',
  ].join('\n');
}

async function run() {
  const gsc = readGscPages(gscPagesPath);
  const sitemap = await discoverSitemaps();
  if (!sitemap.sitemaps.length || sitemap.sitemaps[0].status === 0) {
    throw new Error(`Unable to fetch sitemap index: ${sitemap.sitemaps[0]?.transportError || 'no response'}`);
  }

  const records = new Map();
  for (const entry of sitemap.entries) {
    mergeRecord(records, entry.url, {
      sourceSitemap: entry.sourceSitemap,
      discoverySource: 'sitemap',
      sitemapType: entry.sitemapType,
      lastmod: entry.lastmod,
    });
  }

  const homepage = await discoverHomepage();
  mergeRecord(records, `${BASE_URL}/`, { discoverySource: 'homepage' });
  homepage.allLinks.forEach((url) => mergeRecord(records, url, { discoverySource: 'homepage-link' }));
  homepage.navigationLinks.forEach((url) => mergeRecord(records, url, { discoverySource: 'navigation-link' }));
  homepage.hreflang.forEach((item) => mergeRecord(records, item.url, { discoverySource: 'homepage-hreflang' }));

  const rest = await discoverRestObjects();
  rest.objects.forEach((object) => mergeRecord(records, object.url, {
    discoverySource: 'public-rest',
    restType: object.restType,
    wpObjectId: object.wpObjectId,
    wpParentId: object.wpParentId,
  }));

  for (const record of records.values()) {
    record.urlType = inferUrlType(record.url, record.sitemapType, record.restType);
  }
  const languageHosts = addLanguageRoots(records);
  for (const record of records.values()) {
    record.urlType = inferUrlType(record.url, record.sitemapType, record.restType);
  }

  const seedInspections = new Map([[`${BASE_URL}/`, homepage.inspection]]);
  const inspections = await inspectRecords([...records.values()], seedInspections);
  await inspectLanguageRoots(records, inspections, languageHosts);
  addRedirectAndOutlinkDiscoveries(records, inspections);

  for (const record of records.values()) {
    record.urlType = inferUrlType(record.url, record.sitemapType, record.restType);
  }
  const normalized = normalizeRecords(records, inspections, gsc);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    advisoryOnly: true,
    queryStringsRedacted: true,
    requestPolicy: {
      method: 'GET',
      credentials: 'omit',
      cookies: false,
      formsSubmitted: false,
    },
    configuration: {
      inspectAll,
      maxInspections: inspectAll ? 'all' : maxInspections,
      maxLanguageHosts: Number.isFinite(maxLanguageHosts) ? maxLanguageHosts : 'all',
      maxRestPages: Number.isFinite(maxRestPages) ? maxRestPages : 'all',
      concurrency,
    },
    classifications: CLASSIFICATIONS,
    sitemapIndex: sitemap.rootUrl,
    sitemaps: sitemap.sitemaps,
    discovery: {
      homepageStatus: homepage.response.status,
      homepageLinkCount: homepage.allLinks.length,
      navigationLinkCount: homepage.navigationLinks.length,
      restObjectCount: rest.objects.length,
      restDiagnostics: rest.diagnostics,
      languageHostCount: languageHosts.length,
    },
    gsc: {
      supplied: gsc.supplied,
      rowsRead: gsc.rowsRead,
      warnings: gsc.warnings,
    },
    records: normalized.records,
    duplicateTitles: normalized.duplicateTitles,
    duplicateContent: normalized.duplicateContent,
  };
  report.summary = summarize(report);

  if (mode === 'json') console.log(JSON.stringify(report, null, 2));
  else if (mode === 'markdown') console.log(toMarkdown(report));
  else if (mode === 'csv') console.log(toCsv(report));
  else console.log(toConsole(report));
}

run().catch((error) => {
  console.error(`Audit runtime failure: ${safeError(error)}`);
  process.exitCode = 1;
});
