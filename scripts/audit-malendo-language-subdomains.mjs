#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';

const BASE_URL = 'https://malendo-property.com';
const ROOT_DOMAIN = 'malendo-property.com';
const TIMEOUT_MS = 12000;
const DISCOVERY_PATHS = ['/', '/contact/', '/properties/'];
const HOST_CONCURRENCY = 2;
const NETWORK_CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;
const MAX_REDIRECTS = 6;
const PER_HOST_REQUEST_BUDGET = 8;
const CACHE_VERSION = 2;
const DEFAULT_CACHE_TTL_HOURS = 12;
const CACHE_FLUSH_INTERVAL = 10;
const CURRENT_YEAR = new Date().getFullYear();
const LEGACY_PATTERNS = [
  { label: 'legacy email', pattern: /info@malendo\.property/gi },
  { label: 'legacy copyright', pattern: /(?:2025\s+by\s+Malendo|©\s*2025)/gi },
  { label: 'legacy website domain', pattern: /https?:\/\/(?:www\.)?malendo\.property(?:[\/?#"'\s<]|$)/gi },
];
const MALFORMED_PATTERNS = [
  { label: 'replacement character', pattern: /�/g },
  { label: 'likely UTF-8 mojibake', pattern: /(?:Ã.|Â\s|â(?:€|€™|€œ|€œ|€“|€”))/g },
];
const ENGLISH_MARKERS = [
  'Phuket Real Estate for Rent and Sale',
  'Browse Phuket',
  'Useful Links',
  'All rights reserved',
  'Contact Us',
  'Rent Property',
  'Sell Property',
];

const args = process.argv.slice(2);
const SAFE_FLAGS = new Set(['json', 'markdown', 'no-cache', 'refresh']);
const SAFE_VALUES = new Set(['cache', 'cache-ttl-hours']);
const SENSITIVE_ARGUMENT = /(?:cookie|password|passwd|token|secret|authorization|credential|api[-_]?key|user(?:name)?)/i;

try {
  validateArguments(args);
} catch (error) {
  console.error(`Argument error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const mode = args.includes('--json') ? 'json' : args.includes('--markdown') ? 'markdown' : 'console';
const fetchCache = new Map();
const persistentCache = new Map();
const hostRequestCounts = new Map();
const networkWaiters = [];
let activeNetworkRequests = 0;
let cacheDirtyEntries = 0;
let cacheWriteChain = Promise.resolve();
const cacheEnabled = !args.includes('--no-cache');
const refreshCache = args.includes('--refresh');

function argumentValue(name, fallback = '') {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const configuredCachePath = argumentValue('--cache');
const cachePath = configuredCachePath
  ? path.resolve(configuredCachePath)
  : path.join(os.tmpdir(), 'malendo-language-subdomain-audit-cache-v2.json');
const cacheTtlHours = Number(argumentValue('--cache-ttl-hours', String(DEFAULT_CACHE_TTL_HOURS)));
const cacheTtlMs = Number.isFinite(cacheTtlHours) && cacheTtlHours > 0
  ? cacheTtlHours * 60 * 60 * 1000
  : DEFAULT_CACHE_TTL_HOURS * 60 * 60 * 1000;
const cacheStats = { enabled: cacheEnabled, hits: 0, misses: 0, writes: 0, ignoredExpired: 0, ignoredTransient: 0 };
const transportStats = { networkAttempts: 0, retries: 0, retryAfterHonored: 0, budgetExhausted: 0 };

function validateArguments(argv) {
  const errors = [];
  const outputModes = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) {
      errors.push(`Unexpected positional argument: ${argument}`);
      continue;
    }
    const key = argument.slice(2);
    if (SENSITIVE_ARGUMENT.test(key)) {
      errors.push(`Credential/authentication option is not supported: --${key}`);
      if (argv[index + 1] && !argv[index + 1].startsWith("--")) {
        index += 1;
      }
      continue;
    }
    if (SAFE_FLAGS.has(key)) {
      if (key === 'json' || key === 'markdown') outputModes.push(key);
      continue;
    }
    if (SAFE_VALUES.has(key)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) errors.push(`--${key} requires a value`);
      else index += 1;
      continue;
    }
    errors.push(`Unknown option: --${key}`);
  }
  if (outputModes.length > 1) errors.push('Choose only one output mode: --markdown or --json');
  if (errors.length) throw new Error(errors.join('\n'));
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function decode(value) {
  return String(value ?? '')
    .replace(/&amp;|&#038;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function attr(tag, name) {
  const quoted = tag.match(new RegExp(`\\b${name}\\s*=\\s*(['"])(.*?)\\1`, 'i'));
  if (quoted) return decode(quoted[2].trim());
  const bare = tag.match(new RegExp(`\\b${name}\\s*=\\s*([^\\s>]+)`, 'i'));
  return bare ? decode(bare[1].trim()) : '';
}

function tags(html, name) {
  return String(html ?? '').match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
}

function textOnly(html) {
  return decode(String(html ?? ''))
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleOf(html) {
  return textOnly((String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) ?? [])[1] ?? '');
}

function metaOf(html, wanted) {
  for (const tag of tags(html, 'meta')) {
    if (attr(tag, 'name').toLowerCase() === wanted.toLowerCase()) return attr(tag, 'content');
  }
  return '';
}

function canonicalOf(html, pageUrl = BASE_URL) {
  for (const tag of tags(html, 'link')) {
    if (attr(tag, 'rel').toLowerCase().split(/\s+/).includes('canonical')) return reportUrl(attr(tag, 'href'), pageUrl);
  }
  return '';
}

function h1sOf(html) {
  return [...String(html).matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((match) => textOnly(match[1]))
    .filter(Boolean);
}

function alternateLinks(html, pageUrl) {
  const links = [];
  for (const tag of tags(html, 'link')) {
    const rel = attr(tag, 'rel').toLowerCase().split(/\s+/);
    const language = attr(tag, 'hreflang').toLowerCase();
    const href = attr(tag, 'href');
    if (!rel.includes('alternate') || !language || !href) continue;
    try {
      links.push({ language, url: reportUrl(href, pageUrl) });
    } catch {
      // Ignore malformed alternate URLs but record the raw tag elsewhere via findings.
    }
  }
  return uniqueObjects(links, (item) => `${item.language}|${item.url}`);
}

function anchorLinks(html, pageUrl) {
  const links = [];
  for (const tag of tags(html, 'a')) {
    const href = attr(tag, 'href');
    if (!href || /^(?:#|javascript:|mailto:|tel:)/i.test(href)) continue;
    try {
      links.push(reportUrl(href, pageUrl));
    } catch {
      // Ignore malformed public links.
    }
  }
  return uniq(links);
}

function xmlLocations(xml) {
  return [...String(xml ?? '').matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)]
    .map((match) => reportUrl(decode(match[1]).trim()))
    .filter(Boolean);
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

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

function isLanguageHost(hostname) {
  const host = String(hostname ?? '').toLowerCase().replace(/\.$/, '');
  return host !== ROOT_DOMAIN && host !== `www.${ROOT_DOMAIN}` && host.endsWith(`.${ROOT_DOMAIN}`);
}

function safeHost(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function reportUrl(value, base = BASE_URL) {
  try {
    const url = new URL(value, base);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}

function sameUrl(left, right) {
  try {
    const a = new URL(left);
    const b = new URL(right);
    const clean = (url) => `${url.protocol}//${url.hostname}${url.pathname.replace(/\/+$/, '') || '/'}`;
    return clean(a) === clean(b);
  } catch {
    return false;
  }
}

function hostRoot(urlOrHost) {
  const host = urlOrHost.includes('://') ? new URL(urlOrHost).hostname : urlOrHost;
  return `https://${host}`;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function deterministicNumber(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

async function withNetworkSlot(task) {
  if (activeNetworkRequests >= NETWORK_CONCURRENCY) {
    await new Promise((resolve) => networkWaiters.push(resolve));
  }
  activeNetworkRequests += 1;
  try {
    return await task();
  } finally {
    activeNetworkRequests -= 1;
    networkWaiters.shift()?.();
  }
}

function claimHostBudget(url) {
  const host = safeHost(url) || 'unknown';
  const limit = host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`
    ? PER_HOST_REQUEST_BUDGET * 2
    : PER_HOST_REQUEST_BUDGET;
  const used = hostRequestCounts.get(host) ?? 0;
  if (used >= limit) {
    transportStats.budgetExhausted += 1;
    return false;
  }
  hostRequestCounts.set(host, used + 1);
  return true;
}

function retryAfterMilliseconds(value) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.min(Math.max(date - Date.now(), 0), 30000) : 0;
}

function retryableStatus(status) {
  return status === 429 || status === 408 || status === 425 || status === 502 || status === 503 || status === 504;
}

function transportFailure(type, detail, status = 0, retryAfterMs = 0) {
  return { type, detail, status, retryAfterMs };
}

function sanitizeResponseUrls(response) {
  return {
    ...response,
    requestedUrl: reportUrl(response.requestedUrl),
    finalUrl: reportUrl(response.finalUrl),
    redirectChain: (response.redirectChain ?? []).map((item) => ({
      ...item,
      url: reportUrl(item.url),
      location: reportUrl(item.location),
    })),
  };
}

function serializeCachedResponse(response) {
  const { body, ...metadata } = sanitizeResponseUrls(response);
  return {
    ...metadata,
    bodyGzip: gzipSync(Buffer.from(body ?? '', 'utf8')).toString('base64'),
  };
}

function deserializeCachedResponse(value) {
  const { bodyGzip, ...metadata } = value;
  return sanitizeResponseUrls({
    ...metadata,
    body: bodyGzip ? gunzipSync(Buffer.from(bodyGzip, 'base64')).toString('utf8') : '',
    fromCache: true,
  });
}

function cacheableResponse(response) {
  return !response.transportFailure && (response.status === 200 || response.status === 404 || response.status === 410);
}

async function loadPersistentCache() {
  if (!cacheEnabled || refreshCache) return;
  try {
    const parsed = JSON.parse(await fs.readFile(cachePath, 'utf8'));
    if (parsed.version !== CACHE_VERSION || !Array.isArray(parsed.entries)) return;
    for (const [key, entry] of parsed.entries) persistentCache.set(key, entry);
  } catch (error) {
    if (error?.code !== 'ENOENT') cacheStats.ignoredTransient += 1;
  }
}

function cachedResponse(cacheKey) {
  if (!cacheEnabled || refreshCache) return null;
  const entry = persistentCache.get(cacheKey);
  if (!entry) {
    cacheStats.misses += 1;
    return null;
  }
  if (!entry.savedAt || Date.now() - entry.savedAt > cacheTtlMs) {
    cacheStats.ignoredExpired += 1;
    persistentCache.delete(cacheKey);
    return null;
  }
  try {
    cacheStats.hits += 1;
    return deserializeCachedResponse(entry.response);
  } catch {
    cacheStats.ignoredTransient += 1;
    persistentCache.delete(cacheKey);
    return null;
  }
}

function scheduleCacheWrite(force = false) {
  if (!cacheEnabled || (!force && cacheDirtyEntries < CACHE_FLUSH_INTERVAL)) return cacheWriteChain;
  cacheDirtyEntries = 0;
  cacheWriteChain = cacheWriteChain.then(async () => {
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    const payload = JSON.stringify({
      version: CACHE_VERSION,
      updatedAt: new Date().toISOString(),
      entries: [...persistentCache.entries()],
    });
    const temporaryPath = `${cachePath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, payload, 'utf8');
    await fs.rename(temporaryPath, cachePath);
    cacheStats.writes += 1;
  }).catch(() => {
    cacheStats.ignoredTransient += 1;
  });
  return cacheWriteChain;
}

function storeCachedResponse(cacheKey, response) {
  if (!cacheEnabled || !cacheableResponse(response)) return;
  try {
    persistentCache.set(cacheKey, { savedAt: Date.now(), response: serializeCachedResponse(response) });
    cacheDirtyEntries += 1;
    scheduleCacheWrite();
  } catch {
    cacheStats.ignoredTransient += 1;
  }
}

async function requestAttempt(url, accept) {
  if (!claimHostBudget(url)) {
    return { response: null, failure: transportFailure('budget-exhausted', `Per-host request budget of ${PER_HOST_REQUEST_BUDGET} exhausted`) };
  }
  transportStats.networkAttempts += 1;
  return withNetworkSlot(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        credentials: 'omit',
        headers: {
          accept,
          'user-agent': 'MalendoLanguageSubdomainAudit/2.0 (+https://malendo-property.com)',
          'cache-control': 'no-cache',
        },
        signal: controller.signal,
      });
      return { response, failure: null };
    } catch (error) {
      const detail = error?.name === 'AbortError' ? `Timeout after ${TIMEOUT_MS}ms` : String(error?.message ?? error);
      return { response: null, failure: transportFailure(error?.name === 'AbortError' ? 'timeout' : 'network-error', detail) };
    } finally {
      clearTimeout(timer);
    }
  });
}

async function fetchResource(url, accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.7') {
  const safeRequestedUrl = reportUrl(url);
  if (!safeRequestedUrl) {
    return {
      requestedUrl: '',
      finalUrl: '',
      status: 0,
      ok: false,
      contentType: '',
      body: '',
      redirectChain: [],
      attempts: 0,
      fromCache: false,
      transportFailure: transportFailure('invalid-url', 'Request URL is invalid'),
      error: 'Request URL is invalid',
    };
  }
  const cacheKey = `${accept}|${safeRequestedUrl}`;
  if (fetchCache.has(cacheKey)) return fetchCache.get(cacheKey);
  const saved = cachedResponse(cacheKey);
  if (saved) {
    const promise = Promise.resolve(saved);
    fetchCache.set(cacheKey, promise);
    return promise;
  }
  const promise = (async () => {
    const redirectChain = [];
    let currentUrl = safeRequestedUrl;
    let totalAttempts = 0;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      let attemptResult = null;
      let lastFailure = null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        totalAttempts += 1;
        attemptResult = await requestAttempt(currentUrl, accept);
        if (attemptResult.failure?.type === 'budget-exhausted') {
          lastFailure = attemptResult.failure;
          break;
        }
        if (attemptResult.failure) {
          lastFailure = attemptResult.failure;
        } else if (!retryableStatus(attemptResult.response.status)) {
          lastFailure = null;
          break;
        } else {
          const retryAfterMs = retryAfterMilliseconds(attemptResult.response.headers.get('retry-after'));
          lastFailure = transportFailure('http-retryable', `HTTP ${attemptResult.response.status}`, attemptResult.response.status, retryAfterMs);
          await attemptResult.response.body?.cancel();
        }
        if (attempt < MAX_ATTEMPTS) {
          transportStats.retries += 1;
          const retryAfterMs = lastFailure?.retryAfterMs ?? 0;
          if (retryAfterMs) transportStats.retryAfterHonored += 1;
          await wait(retryAfterMs || Math.min(1000 * (2 ** (attempt - 1)), 8000));
        }
      }

      if (lastFailure || !attemptResult?.response) {
        return {
          requestedUrl: safeRequestedUrl,
          finalUrl: reportUrl(currentUrl),
          status: lastFailure?.status ?? 0,
          ok: false,
          contentType: '',
          body: '',
          redirectChain,
          attempts: totalAttempts,
          fromCache: false,
          transportFailure: lastFailure ?? transportFailure('network-error', 'Request did not produce a response'),
          error: lastFailure?.detail ?? 'Request did not produce a response',
        };
      }

      const response = attemptResult.response;
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        const nextUrl = reportUrl(location, currentUrl);
        redirectChain.push({ status: response.status, url: reportUrl(currentUrl), location: nextUrl });
        currentUrl = nextUrl;
        continue;
      }
      const result = {
        requestedUrl: safeRequestedUrl,
        finalUrl: reportUrl(currentUrl),
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get('content-type') ?? '',
        body: await response.text(),
        redirectChain,
        attempts: totalAttempts,
        fromCache: false,
        transportFailure: null,
        error: '',
      };
      storeCachedResponse(cacheKey, result);
      return result;
    }
    return {
      requestedUrl: safeRequestedUrl,
      finalUrl: reportUrl(currentUrl),
      status: 0,
      ok: false,
      contentType: '',
      body: '',
      redirectChain,
      attempts: totalAttempts,
      fromCache: false,
      transportFailure: transportFailure('redirect-limit', `More than ${MAX_REDIRECTS} redirects`),
      error: `More than ${MAX_REDIRECTS} redirects`,
    };
  })();
  fetchCache.set(cacheKey, promise);
  return promise;
}

function contactLinksOf(html, pageUrl) {
  const contacts = [];
  for (const tag of tags(html, 'a')) {
    const href = attr(tag, 'href').trim();
    if (!href || !/^(?:mailto:|tel:|https?:)/i.test(href)) continue;
    let type = '';
    let issue = '';
    let reportedHref = href.split('?')[0];
    if (/^mailto:/i.test(href)) {
      type = 'email';
      const email = href.replace(/^mailto:/i, '').split('?')[0].trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issue = 'Malformed email link';
      else if (/info@malendo\.property/i.test(email)) issue = 'Legacy email domain';
    } else if (/^tel:/i.test(href)) {
      type = 'phone';
      if (href.replace(/\D/g, '').length < 8) issue = 'Malformed telephone link';
    } else {
      let parsed;
      try {
        parsed = new URL(href, pageUrl);
      } catch {
        continue;
      }
      if (/(?:^|\.)(?:wa\.me|whatsapp\.com)$/i.test(parsed.hostname) || /api\.whatsapp\.com/i.test(parsed.hostname)) {
        type = 'whatsapp';
        const digits = `${parsed.pathname}${parsed.searchParams.get('phone') ?? ''}`.replace(/\D/g, '');
        if (digits.length < 8) issue = 'WhatsApp link has no valid phone number';
      } else if (/\b(?:contact|submit|application)\b/i.test(parsed.pathname)) {
        type = 'internal contact';
        if (parsed.protocol !== 'https:') issue = 'Contact destination is not HTTPS';
        else if (parsed.hostname !== ROOT_DOMAIN && parsed.hostname !== `www.${ROOT_DOMAIN}` && !isLanguageHost(parsed.hostname)) issue = 'Contact destination leaves the Malendo domain';
      }
      reportedHref = reportUrl(parsed.href);
    }
    if (type) contacts.push({ type, href: reportedHref, issue });
  }
  return uniqueObjects(contacts, (item) => `${item.type}|${item.href}`);
}

function staleCopyrightOf(text) {
  const findings = [];
  const patterns = [/(?:©|copyright)\s*(20\d{2})/gi, /(20\d{2})\s+by\s+Malendo/gi];
  for (const pattern of patterns) {
    for (const match of String(text).matchAll(pattern)) {
      const year = Number(match[1]);
      if (year < CURRENT_YEAR) findings.push({ year, text: match[0] });
    }
  }
  return uniqueObjects(findings, (item) => `${item.year}|${item.text}`);
}

function placeholderOf(text) {
  const matches = [];
  for (const pattern of [/\bcoming soon\b/i, /\bunder construction\b/i, /\blorem ipsum\b/i, /\btest page\b/i]) {
    const match = String(text).match(pattern);
    if (match) matches.push(match[0]);
  }
  return uniq(matches);
}

function fingerprint(text) {
  let hash = 2166136261;
  for (const character of String(text)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function scanPatterns(html, rules) {
  const results = [];
  for (const rule of rules) {
    const matches = [...String(html).matchAll(new RegExp(rule.pattern.source, rule.pattern.flags))];
    if (matches.length) results.push({ label: rule.label, count: matches.length, examples: uniq(matches.map((match) => match[0])).slice(0, 3) });
  }
  return results;
}

function legacyFindings(html) {
  const withoutOfficialSocials = String(html)
    .replace(/https?:\/\/(?:www\.)?instagram\.com\/malendo\.property\/?/gi, '')
    .replace(/https?:\/\/(?:www\.)?facebook\.com\/Malendo\.Property\/?/gi, '');
  return scanPatterns(withoutOfficialSocials, LEGACY_PATTERNS);
}

function normalizedWords(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function similarity(left, right) {
  const a = new Set(normalizedWords(left));
  const b = new Set(normalizedWords(right));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection += 1;
  return intersection / new Set([...a, ...b]).size;
}

function inspectPage(resource, expectedHost, baseComparison) {
  const html = resource.body;
  const finalHost = safeHost(resource.finalUrl);
  const title = titleOf(html);
  const description = metaOf(html, 'description');
  const robots = metaOf(html, 'robots');
  const canonical = canonicalOf(html, resource.finalUrl || resource.requestedUrl);
  const h1s = h1sOf(html);
  const alternates = alternateLinks(html, resource.finalUrl || resource.requestedUrl);
  const bodyText = textOnly(html);
  const comparisonText = baseComparison ? textOnly(baseComparison.body) : '';
  const contentSimilarity = comparisonText ? similarity(bodyText, comparisonText) : 0;
  const englishMarkers = ENGLISH_MARKERS.filter((marker) => bodyText.toLowerCase().includes(marker.toLowerCase()));
  const malformed = scanPatterns(html, MALFORMED_PATTERNS);
  const legacy = legacyFindings(html);
  const canonicalHost = safeHost(canonical);
  const canonicalSelf = canonical ? sameUrl(canonical, resource.finalUrl || resource.requestedUrl) : false;
  const indexable = !/(?:^|[,\s])noindex(?:[,\s]|$)/i.test(robots);
  return {
    requestedUrl: resource.requestedUrl,
    finalUrl: resource.finalUrl,
    status: resource.status,
    error: resource.error,
    attempts: resource.attempts ?? 0,
    fromCache: Boolean(resource.fromCache),
    transportFailure: resource.transportFailure ?? null,
    redirectChain: resource.redirectChain ?? [],
    redirectCount: resource.redirectChain?.length ?? 0,
    redirected: Boolean(resource.redirectChain?.length),
    remainedOnHost: finalHost === expectedHost,
    title,
    titleLength: title.length,
    metaDescription: description,
    metaDescriptionLength: description.length,
    h1s,
    h1Count: h1s.length,
    robots,
    indexable,
    canonical,
    canonicalSelf,
    canonicalHost,
    wrongLanguageCanonical: Boolean(canonicalHost && canonicalHost !== expectedHost),
    alternates,
    xDefault: alternates.find((item) => item.language === 'x-default')?.url ?? '',
    legacy,
    malformed,
    englishMarkers,
    wordCount: normalizedWords(bodyText).length,
    bodyFingerprint: fingerprint(normalizedWords(bodyText).join(' ')),
    contactLinks: contactLinksOf(html, resource.finalUrl || resource.requestedUrl),
    brokenContactLinks: contactLinksOf(html, resource.finalUrl || resource.requestedUrl).filter((link) => link.issue),
    staleCopyright: staleCopyrightOf(bodyText),
    placeholderMarkers: placeholderOf(bodyText),
    contentSimilarity: Number(contentSimilarity.toFixed(3)),
    exactTitleDuplicate: Boolean(baseComparison && title && title === titleOf(baseComparison.body)),
    exactH1Duplicate: Boolean(baseComparison && h1s.length && JSON.stringify(h1s) === JSON.stringify(h1sOf(baseComparison.body))),
  };
}

async function discoverHosts() {
  const hostEvidence = new Map();
  const discoveryPages = [];
  const record = (host, source, detail, language = '') => {
    if (!isLanguageHost(host)) return;
    if (!hostEvidence.has(host)) hostEvidence.set(host, { host, languages: new Set(), evidence: [] });
    const entry = hostEvidence.get(host);
    if (language && language !== 'x-default') entry.languages.add(language);
    entry.evidence.push({ source, detail });
  };

  for (const path of DISCOVERY_PATHS) {
    const url = new URL(path, BASE_URL).href;
    const resource = await fetchResource(url);
    discoveryPages.push(resource);
    for (const alternate of alternateLinks(resource.body, resource.finalUrl || url)) {
      record(safeHost(alternate.url), 'hreflang', `${alternate.language}: ${alternate.url}`, alternate.language);
    }
    for (const link of anchorLinks(resource.body, resource.finalUrl || url)) {
      record(safeHost(link), 'public link', link);
    }
    if (resource.finalUrl) record(safeHost(resource.finalUrl), 'redirect', `${url} -> ${resource.finalUrl}`);
  }

  const sitemapUrl = `${BASE_URL}/sitemap_index.xml`;
  const sitemap = await fetchResource(sitemapUrl, 'application/xml,text/xml,*/*;q=0.8');
  const sitemapLocations = xmlLocations(sitemap.body);
  for (const location of sitemapLocations) record(safeHost(location), 'base sitemap', location);

  const initialHosts = [...hostEvidence.keys()];
  await mapLimit(initialHosts, HOST_CONCURRENCY, async (host) => {
    const requestedUrl = hostRoot(host);
    const response = await fetchResource(requestedUrl);
    const finalHost = safeHost(response.finalUrl);
    if (response.redirectChain.length) {
      record(host, 'redirect', `${requestedUrl} -> ${response.finalUrl}`);
      record(finalHost, 'redirect destination', `${requestedUrl} -> ${response.finalUrl}`);
    }
  });

  for (const evidence of hostEvidence.values()) {
    evidence.evidence = uniqueObjects(evidence.evidence, (item) => `${item.source}|${item.detail}`);
  }
  return {
    discoveryPages,
    sitemap: { url: sitemapUrl, status: sitemap.status, finalUrl: sitemap.finalUrl, locations: sitemapLocations },
    hosts: [...hostEvidence.values()].map((entry) => ({
      host: entry.host,
      languages: [...entry.languages].sort(),
      evidence: entry.evidence,
    })).sort((a, b) => a.host.localeCompare(b.host)),
  };
}

function pathsForHost(host, discovery) {
  const paths = ['/'];
  for (const page of discovery.discoveryPages) {
    for (const alternate of alternateLinks(page.body, page.finalUrl || page.requestedUrl)) {
      if (safeHost(alternate.url) === host) {
        try {
          paths.push(`${new URL(alternate.url).pathname}${new URL(alternate.url).search}`);
        } catch {
          // Ignore malformed discovery URL.
        }
      }
    }
  }
  const hostEntry = discovery.hosts.find((entry) => entry.host === host);
  for (const evidence of hostEntry?.evidence ?? []) {
    if (!['hreflang', 'public link', 'redirect', 'redirect destination'].includes(evidence.source)) continue;
    for (const match of evidence.detail.matchAll(/https?:\/\/[^\s]+/gi)) {
      try {
        const url = new URL(match[0]);
        if (url.hostname.toLowerCase() === host) paths.push(`${url.pathname}${url.search}`);
      } catch {
        // Ignore punctuation or malformed evidence URLs.
      }
    }
  }
  const discoveredPaths = uniq(paths).sort();
  const secondaryPaths = discoveredPaths.filter((item) => item !== '/');
  const fallbackPaths = DISCOVERY_PATHS.filter((item) => item !== '/');
  const candidates = secondaryPaths.length ? secondaryPaths : fallbackPaths;
  const representative = candidates[deterministicNumber(host) % candidates.length];
  return {
    discoveredPaths,
    sampledPaths: uniq(['/', representative]),
  };
}

async function sitemapForHost(host, auditedUrls) {
  const candidates = [`https://${host}/sitemap_index.xml`, `https://${host}/wp-sitemap.xml`];
  const responses = [];
  for (const candidate of candidates) {
    const response = await fetchResource(candidate, 'application/xml,text/xml,*/*;q=0.8');
    responses.push(response);
    if (response.status === 200 && /<(?:sitemapindex|urlset)\b/i.test(response.body)) break;
    if (response.transportFailure) break;
  }
  for (let index = 0; index < responses.length; index += 1) {
    const url = candidates[index];
    const response = responses[index];
    if (response.status === 200 && /<(?:sitemapindex|urlset)\b/i.test(response.body)) {
      const locations = xmlLocations(response.body);
      let pageLocations = response.body.match(/<urlset\b/i) ? locations : [];
      const pageSitemaps = locations
        .filter((location) => safeHost(location) === host && /(?:page-sitemap|wp-sitemap-posts-page)/i.test(location))
        .slice(0, 1);
      if (pageSitemaps.length) {
        const childResponses = await Promise.all(pageSitemaps.map((location) => fetchResource(location, 'application/xml,text/xml,*/*;q=0.8')));
        pageLocations = uniq(childResponses.flatMap((child) => child.status === 200 ? xmlLocations(child.body) : []));
        responses.push(...childResponses);
      }
      return {
        requestedUrl: url,
        finalUrl: response.finalUrl,
        status: response.status,
        type: /<sitemapindex\b/i.test(response.body) ? 'index' : 'urlset',
        locationCount: locations.length,
        ownHostLocations: locations.filter((location) => safeHost(location) === host).length,
        crossHostLocations: locations.filter((location) => safeHost(location) && safeHost(location) !== host).slice(0, 10),
        checkedPageSitemaps: pageSitemaps,
        pageLocationCount: pageLocations.length,
        pageChecks: auditedUrls.map((url) => ({
          url,
          included: pageLocations.some((location) => sameUrl(location, url)),
          status: pageLocations.length ? 'checked' : 'unknown',
        })),
        transportFailures: responses.filter((item) => item.transportFailure).map((item) => ({
          url: item.requestedUrl,
          status: item.status,
          attempts: item.attempts,
          ...item.transportFailure,
        })),
      };
    }
  }
  return {
    requestedUrl: candidates[0],
    finalUrl: responses.at(-1)?.finalUrl ?? '',
    status: responses.at(-1)?.status ?? 0,
    type: 'none',
    locationCount: 0,
    ownHostLocations: 0,
    crossHostLocations: [],
    checkedPageSitemaps: [],
    pageLocationCount: 0,
    pageChecks: auditedUrls.map((url) => ({ url, included: false, status: 'unknown' })),
    transportFailures: responses.filter((item) => item.transportFailure).map((item) => ({
      url: item.requestedUrl,
      status: item.status,
      attempts: item.attempts,
      ...item.transportFailure,
    })),
  };
}

function reciprocityForPage(page, sourceUrl) {
  const linksBack = page.alternates.filter((alternate) => {
    const host = safeHost(alternate.url);
    return host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`;
  });
  const reciprocal = linksBack.some((alternate) => sameUrl(alternate.url, sourceUrl)) || linksBack.some((alternate) => ['en', 'en-us', 'en-gb'].includes(alternate.language));
  return { reciprocal, linksBack };
}

function classifyHost(hostResult) {
  const successful = hostResult.pages.filter((page) => page.status === 200 && page.remainedOnHost);
  const transportUncertain = hostResult.transportFailures.length > 0;
  const allDefinitivelyUnavailable = hostResult.pages.every((page) =>
    !page.transportFailure && ([404, 410].includes(page.status) || (page.redirected && !page.remainedOnHost)));
  const severeQuality = successful.some((page) =>
    page.malformed.length || page.legacy.length || page.brokenContactLinks.length ||
    (page.placeholderMarkers.length && page.indexable) || page.contentSimilarity >= 0.9 ||
    (page.englishMarkers.length >= 3 && !hostResult.languages.some((language) => language.startsWith('en')))) ||
    hostResult.seoFindings?.some((finding) => finding.area === 'duplicate content' && finding.severity === 'high');
  const indexingConflict = successful.some((page) => !page.indexable || !page.canonicalSelf || (page.canonicalHost && page.canonicalHost !== hostResult.host));
  const technicalGaps = successful.some((page) =>
    !page.title || !page.metaDescription || page.h1Count !== 1 || !page.xDefault || !page.reciprocity.reciprocal);

  if (allDefinitivelyUnavailable) return 'disable only after GSC confirmation';
  if (transportUncertain) return 'manual review';
  if (!successful.length) return 'manual review';
  if (severeQuality || indexingConflict) return 'noindex pending GSC review';
  if (technicalGaps || hostResult.sitemap.type === 'none') return 'keep but correct';
  return 'keep indexed';
}

function findingsForHost(hostResult) {
  const seoFindings = [];
  const transportFailures = [...(hostResult.sitemap.transportFailures ?? [])];
  const addSeo = (area, severity, pageUrl, detail) => seoFindings.push({ area, severity, pageUrl, detail });
  const addTransport = (page) => transportFailures.push({
    url: page.requestedUrl,
    finalUrl: page.finalUrl,
    status: page.status,
    attempts: page.attempts,
    ...(page.transportFailure ?? transportFailure('http-error', page.error || `HTTP ${page.status}`, page.status)),
  });
  for (const page of hostResult.pages) {
    if (page.transportFailure || page.status === 0 || [403, 408, 425, 429, 502, 503, 504].includes(page.status)) {
      addTransport(page);
      page.sitemapInclusion = { url: page.requestedUrl, included: false, status: 'unknown' };
      continue;
    }
    if (page.status !== 200) {
      addSeo('HTTP', 'high', page.requestedUrl, `HTTP ${page.status}`);
      page.sitemapInclusion = { url: page.requestedUrl, included: false, status: 'unknown' };
      continue;
    }
    if (!page.remainedOnHost) addSeo('redirect', 'high', page.requestedUrl, `Redirects off-host to ${page.finalUrl}`);
    if (page.redirectCount > 1) addSeo('redirect', 'medium', page.requestedUrl, `Redirect chain has ${page.redirectCount} hops`);
    if (!page.title) addSeo('title', 'medium', page.requestedUrl, 'Missing title');
    if (!page.metaDescription) addSeo('meta', 'medium', page.requestedUrl, 'Missing meta description');
    if (page.h1Count !== 1) addSeo('H1', 'medium', page.requestedUrl, `Expected one H1; found ${page.h1Count}`);
    if (!page.robots) addSeo('robots', 'low', page.requestedUrl, 'No robots meta; defaults to indexable');
    if (!page.canonical) addSeo('canonical', 'high', page.requestedUrl, 'Missing canonical');
    else if (page.wrongLanguageCanonical) addSeo('canonical', 'high', page.requestedUrl, `Canonical points to another language host: ${page.canonical}`);
    else if (!page.canonicalSelf) addSeo('canonical', 'high', page.requestedUrl, `Canonical is not the audited URL: ${page.canonical}`);
    if (!page.xDefault) addSeo('hreflang', 'medium', page.requestedUrl, 'Missing x-default alternate');
    if (!page.reciprocity.reciprocal) addSeo('hreflang', 'high', page.requestedUrl, 'No reciprocal English/base alternate found');
    if (page.contentSimilarity >= 0.9) addSeo('duplicate content', 'high', page.requestedUrl, `English baseline similarity ${page.contentSimilarity}`);
    else if (page.contentSimilarity >= 0.7) addSeo('duplicate content', 'medium', page.requestedUrl, `English baseline similarity ${page.contentSimilarity}`);
    if (page.englishMarkers.length >= 3 && !hostResult.languages.some((language) => language.startsWith('en'))) {
      addSeo('translation', 'high', page.requestedUrl, `English markers remain: ${page.englishMarkers.join(', ')}`);
    }
    for (const issue of page.malformed) addSeo('translation', 'high', page.requestedUrl, `${issue.label}: ${issue.examples.join(', ')}`);
    for (const issue of page.legacy) addSeo('legacy data', 'high', page.requestedUrl, `${issue.label}: ${issue.examples.join(', ')}`);
    for (const link of page.brokenContactLinks) addSeo('contact link', 'high', page.requestedUrl, `${link.issue}: ${link.href}`);
    for (const copyright of page.staleCopyright) addSeo('copyright', 'medium', page.requestedUrl, `Stale year ${copyright.year}: ${copyright.text}`);
    if (page.placeholderMarkers.length && page.indexable) addSeo('placeholder', 'high', page.requestedUrl, `Indexable placeholder markers: ${page.placeholderMarkers.join(', ')}`);
    const sitemapCheck = hostResult.sitemap.pageChecks.find((item) => sameUrl(item.url, page.requestedUrl));
    page.sitemapInclusion = sitemapCheck ?? { url: page.requestedUrl, included: false, status: 'unknown' };
  }
  if (hostResult.sitemap.type === 'none' && !hostResult.sitemap.transportFailures.length) addSeo('sitemap', 'medium', hostRoot(hostResult.host), 'No language-host sitemap detected');
  else if (hostResult.sitemap.type !== 'none' && !hostResult.sitemap.ownHostLocations) addSeo('sitemap', 'medium', hostResult.sitemap.requestedUrl, 'Sitemap contains no URLs on its own host');
  return {
    seoFindings,
    transportFailures: uniqueObjects(transportFailures, (item) => `${item.url}|${item.type}|${item.status}`),
  };
}

async function auditHost(hostEntry, discovery) {
  const sampling = pathsForHost(hostEntry.host, discovery);
  const paths = sampling.sampledPaths;
  const auditedUrls = paths.map((path) => new URL(path, hostRoot(hostEntry.host)).href);
  const pagesPromise = Promise.all(paths.map(async (path) => {
    const targetUrl = new URL(path, hostRoot(hostEntry.host)).href;
    const baseUrl = new URL(path, BASE_URL).href;
    const [resource, baseComparison] = await Promise.all([fetchResource(targetUrl), fetchResource(baseUrl)]);
    const inspected = inspectPage(resource, hostEntry.host, baseComparison);
    inspected.reciprocity = reciprocityForPage(inspected, baseUrl);
    return inspected;
  }));
  const [pages, sitemap] = await Promise.all([pagesPromise, sitemapForHost(hostEntry.host, auditedUrls)]);
  const partial = { ...hostEntry, sampling, pages, sitemap };
  const separated = findingsForHost(partial);
  const result = { ...partial, ...separated };
  result.classification = classifyHost(result);
  return result;
}

function duplicateGroups(hosts) {
  const fields = [
    ['title', (page) => page.title.trim().toLowerCase(), 10],
    ['meta description', (page) => page.metaDescription.trim().toLowerCase(), 20],
    ['body content', (page) => page.wordCount >= 100 ? page.bodyFingerprint : '', 1],
  ];
  const groups = [];
  for (const [field, valueOf, minimumLength] of fields) {
    const values = new Map();
    for (const host of hosts) {
      for (const page of host.pages) {
        const value = valueOf(page);
        if (!value || value.length < minimumLength) continue;
        if (!values.has(value)) values.set(value, []);
        values.get(value).push({ host: host.host, url: page.requestedUrl });
      }
    }
    for (const matches of values.values()) {
      if (new Set(matches.map((item) => item.host)).size > 1) groups.push({ field, matches });
    }
  }
  return groups;
}

function applyDuplicateFindings(hosts, groups) {
  for (const group of groups) {
    for (const match of group.matches) {
      const host = hosts.find((item) => item.host === match.host);
      if (!host) continue;
      host.seoFindings.push({
        area: 'duplicate content',
        severity: group.field === 'body content' ? 'high' : 'medium',
        pageUrl: match.url,
        detail: `Exact ${group.field} duplicate across ${new Set(group.matches.map((item) => item.host)).size} language hosts`,
      });
    }
  }
  for (const host of hosts) host.classification = classifyHost(host);
}

function classificationCounts(hosts) {
  const counts = {};
  for (const host of hosts) counts[host.classification] = (counts[host.classification] ?? 0) + 1;
  return counts;
}

function countBy(items, valueOf) {
  const counts = {};
  for (const item of items) {
    const value = String(valueOf(item));
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function recommendationFor(classification) {
  const map = {
    'keep indexed': 'Keep indexed; monitor hreflang, Search Console and translation quality.',
    'keep but correct': 'Correct the listed metadata, hreflang, sitemap or translation defects before expanding indexation.',
    'noindex pending GSC review': 'Review Search Console traffic and leads, then noindex temporarily while material quality conflicts are corrected.',
    'disable only after GSC confirmation': 'Do not disable yet. Confirm traffic, backlinks and indexed URLs in Search Console, then plan redirects before DNS/GTranslate changes.',
    'manual review': 'Insufficient reliable evidence; inspect manually before changing indexation or host configuration.',
  };
  return map[classification];
}

async function buildReport() {
  await loadPersistentCache();
  const discovery = await discoverHosts();
  const hosts = await mapLimit(discovery.hosts, HOST_CONCURRENCY, (host) => auditHost(host, discovery));
  const duplicates = duplicateGroups(hosts);
  applyDuplicateFindings(hosts, duplicates);
  await scheduleCacheWrite(true);
  const warnings = [];
  if (!hosts.length) warnings.push('No language subdomains were discoverable from public hreflang, sitemap, redirect or link evidence. Review GTranslate configuration manually.');
  const pages = hosts.flatMap((host) => host.pages);
  const failures = hosts.flatMap((host) => host.transportFailures);
  if (failures.length) warnings.push(`${failures.length} transport failures are reported separately and do not create SEO findings or disable recommendations.`);
  return {
    generatedAt: new Date().toISOString(),
    advisory: true,
    baseUrl: BASE_URL,
    discovery: {
      paths: DISCOVERY_PATHS,
      pages: discovery.discoveryPages.map((page) => ({ requestedUrl: page.requestedUrl, finalUrl: page.finalUrl, status: page.status, error: page.error })),
      sitemap: discovery.sitemap,
      hostCount: hosts.length,
    },
    classifications: classificationCounts(hosts),
    statusDistribution: countBy(pages, (page) => page.status || 'transport-error'),
    transport: {
      failureCount: failures.length,
      failuresByType: countBy(failures, (failure) => failure.type),
      ...transportStats,
      hostRequestCounts: Object.fromEntries([...hostRequestCounts.entries()].sort()),
    },
    cache: {
      ...cacheStats,
      ttlHours: cacheTtlMs / (60 * 60 * 1000),
      location: cacheEnabled ? 'OS temporary directory or explicit --cache path' : 'disabled',
    },
    hosts,
    duplicateGroups: duplicates,
    warnings,
    safety: [
      'Read-only HTTP GET requests only.',
      'Do not change GTranslate, DNS, Cloudflare, redirects, robots, canonicals or sitemaps from this report alone.',
      'Check Google Search Console before noindexing or disabling any language host.',
    ],
  };
}

function md(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function renderMarkdown(report) {
  const lines = [
    '# Malendo Language Subdomain SEO Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Executive Summary',
    '',
    `- Language hosts discovered: ${report.discovery.hostCount}`,
    `- Discovery pages: ${report.discovery.pages.map((page) => `${page.requestedUrl} (HTTP ${page.status})`).join(', ')}`,
    `- Base sitemap: HTTP ${report.discovery.sitemap.status}; ${report.discovery.sitemap.locations.length} entries`,
    `- Deterministically sampled language URLs: ${report.hosts.reduce((sum, host) => sum + host.pages.length, 0)}`,
    `- HTTP status distribution: ${Object.entries(report.statusDistribution).map(([status, count]) => `${status}: ${count}`).join('; ')}`,
    `- Transport failures: ${report.transport.failureCount} (${Object.entries(report.transport.failuresByType).map(([type, count]) => `${type}: ${count}`).join('; ') || 'none'})`,
    `- Cache: ${report.cache.enabled ? `${report.cache.hits} hits, ${report.cache.misses} misses, ${report.cache.writes} writes` : 'disabled'}`,
    `- Exact cross-host duplicate groups: ${report.duplicateGroups.length}`,
    `- Classifications: ${Object.entries(report.classifications).map(([name, count]) => `${name}: ${count}`).join('; ') || 'none'}`,
    '',
  ];
  if (report.warnings.length) {
    lines.push('## Audit Warnings', '', ...report.warnings.map((warning) => `- ${warning}`), '');
  }
  lines.push(
    '## Host Classification',
    '',
    '| Host | Language evidence | Sample | SEO findings | Transport failures | Sitemap | Classification | Recommendation |',
    '| --- | --- | ---: | ---: | ---: | --- | --- | --- |',
    ...report.hosts.map((host) => `| ${host.host} | ${md(host.languages.join(', ') || 'unknown')} | ${host.pages.length}/${host.sampling.discoveredPaths.length} | ${host.seoFindings.length} | ${host.transportFailures.length} | ${host.sitemap.type === 'none' ? 'not detected' : `${host.sitemap.type}, ${host.sitemap.locationCount} URLs`} | ${host.classification} | ${md(recommendationFor(host.classification))} |`),
    '',
    '## Page Evidence',
    '',
    '| Host | URL | HTTP / final URL | Title / H1 | Robots | Canonical | Hreflang | Sitemap | Similarity |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | ---: |',
  );
  for (const host of report.hosts) {
    for (const page of host.pages) {
      lines.push(`| ${host.host} | ${md(page.requestedUrl)} | ${page.status}${page.redirected ? ` → ${md(page.finalUrl)} (${page.redirectCount} hop${page.redirectCount === 1 ? '' : 's'})` : ''} | ${md(page.title || '(missing)')} / ${md(page.h1s.join(' · ') || '(missing)')} | ${md(page.robots || '(default indexable)')} | ${md(page.canonical || '(missing)')} | ${page.alternates.length} alternates; reciprocal ${page.reciprocity.reciprocal ? 'yes' : 'no'}; x-default ${page.xDefault ? 'yes' : 'no'} | ${page.sitemapInclusion?.status === 'checked' ? (page.sitemapInclusion.included ? 'included' : 'not found') : 'unknown'} | ${page.contentSimilarity} |`);
    }
  }
  lines.push('', '## SEO Findings', '');
  const allFindings = report.hosts.flatMap((host) => host.seoFindings.map((finding) => ({ host: host.host, ...finding })));
  if (!allFindings.length) lines.push('- No actionable defects detected in the sampled pages.');
  else {
    lines.push('| Severity | Host | Area | URL | Evidence |', '| --- | --- | --- | --- | --- |');
    for (const finding of allFindings) lines.push(`| ${finding.severity} | ${finding.host} | ${finding.area} | ${md(finding.pageUrl)} | ${md(finding.detail)} |`);
  }
  lines.push('', '## Transport Failures', '');
  const allTransport = report.hosts.flatMap((host) => host.transportFailures.map((failure) => ({ host: host.host, ...failure })));
  if (!allTransport.length) lines.push('- None.');
  else {
    lines.push('| Host | Type | HTTP | Attempts | URL | Detail |', '| --- | --- | ---: | ---: | --- | --- |');
    for (const failure of allTransport) lines.push(`| ${failure.host} | ${failure.type} | ${failure.status || '-'} | ${failure.attempts || '-'} | ${md(failure.url)} | ${md(failure.detail)} |`);
  }
  lines.push('', '## Duplicate Groups', '');
  if (!report.duplicateGroups.length) lines.push('- No exact cross-host title, description or body duplicates detected.');
  else {
    lines.push('| Field | Host count | URLs |', '| --- | ---: | --- |');
    for (const group of report.duplicateGroups) {
      lines.push(`| ${group.field} | ${new Set(group.matches.map((item) => item.host)).size} | ${md(group.matches.map((item) => item.url).join(', '))} |`);
    }
  }
  lines.push('', '## Discovery Evidence', '');
  for (const host of report.hosts) {
    lines.push(`### ${host.host}`, '', ...host.evidence.map((item) => `- ${item.source}: ${item.detail}`), '');
  }
  lines.push(
    '## Safety Notes',
    '',
    ...report.safety.map((item) => `- ${item}`),
    '',
    'This report is advisory and makes no production changes.',
  );
  return lines.join('\n');
}

function renderConsole(report) {
  const lines = [
    'Malendo language subdomain SEO audit',
    `Generated: ${report.generatedAt}`,
    `Hosts discovered: ${report.discovery.hostCount}`,
    `Deterministically sampled language URLs: ${report.hosts.reduce((sum, host) => sum + host.pages.length, 0)}`,
    `Base sitemap: HTTP ${report.discovery.sitemap.status}, ${report.discovery.sitemap.locations.length} entries`,
    `Exact duplicate groups: ${report.duplicateGroups.length}`,
    `HTTP status distribution: ${Object.entries(report.statusDistribution).map(([status, count]) => `${status}=${count}`).join(', ')}`,
    `Transport failures: ${report.transport.failureCount}`,
    `Cache: ${report.cache.enabled ? `${report.cache.hits} hits, ${report.cache.misses} misses, ${report.cache.writes} writes` : 'disabled'}`,
    '',
  ];
  if (report.warnings.length) lines.push('Warnings:', ...report.warnings.map((warning) => `- ${warning}`), '');
  lines.push('Host classifications:');
  if (!report.hosts.length) lines.push('- None discovered');
  for (const host of report.hosts) {
    lines.push(`- ${host.host} [${host.languages.join(', ') || 'unknown'}]: ${host.classification}`);
    lines.push(`  sample=${host.pages.length}/${host.sampling.discoveredPaths.length}, seo=${host.seoFindings.length}, transport=${host.transportFailures.length}, sitemap=${host.sitemap.type}`);
    for (const finding of host.seoFindings) lines.push(`  SEO ${finding.severity.toUpperCase()} ${finding.area}: ${finding.pageUrl} — ${finding.detail}`);
    for (const failure of host.transportFailures) lines.push(`  TRANSPORT ${failure.type}: ${failure.url} — ${failure.detail}`);
  }
  lines.push('', 'No production changes were made. Check GSC before noindexing or disabling any host.');
  return lines.join('\n');
}

try {
  const report = await buildReport();
  if (mode === 'json') console.log(JSON.stringify(report, null, 2));
  else if (mode === 'markdown') console.log(renderMarkdown(report));
  else console.log(renderConsole(report));
} catch (error) {
  console.error(`Language subdomain audit failed: ${error?.stack ?? error}`);
  process.exitCode = 1;
}
