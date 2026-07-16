#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const FETCH_TIMEOUT_MS = 20000;
const USER_AGENT = 'MalendoVerificationPageQA/1.0 (+https://malendo-property.com)';
const APPROVED_CTA_HOSTS = new Set(['malendo-property.com', 'www.malendo-property.com']);
const APPROVED_CTA_PATH = '/request-phuket-project-check/';
const APPROVED_CTA_HASHES = new Set(['', '#current-availability', '#compare-projects', '#send-documents']);
const VERIFICATION_TABLE_CLASSES = new Set([
  'malendo-verification-table',
  'malendo-source-table',
  'malendo-project-facts',
  'malendo-developer-projects',
]);
const CLASSIFICATIONS = [
  ['verified', 'Verified'],
  ['developer-claim', 'Developer claim'],
  ['public-report', 'Public report'],
  ['inconsistency', 'Inconsistency'],
  ['unknown', 'Unknown'],
  ['buyer-question', 'Buyer question'],
];
const UNSUPPORTED_WORDING = [
  { label: 'guaranteed return/yield/income/profit', pattern: /\bguaranteed\s+(?:rental\s+)?(?:return|yield|income|profit|roi|capital\s+appreciation)s?\b/i },
  { label: 'return/yield described as guaranteed', pattern: /\b(?:return|yield|income|profit|roi)s?\s+(?:is|are)?\s*guaranteed\b/i },
  { label: 'risk-free investment wording', pattern: /\brisk[ -]?free\s+(?:investment|return|income|profit)\b/i },
  { label: 'fixed or assured return wording', pattern: /\b(?:fixed|assured)\s+(?:rental\s+)?(?:return|yield|income|profit|roi)s?\b/i },
  { label: 'numeric yield/return/ROI claim requires source review', pattern: /(?:\b(?:up to\s+)?\d+(?:\.\d+)?%\s+(?:(?:annual|yearly|p\.a\.)\s+)?(?:rental\s+)?(?:yield|return|roi)\b|\b(?:yield|return|roi)\s+(?:of\s+)?\d+(?:\.\d+)?%\b)/i },
];

const cli = parseCli(process.argv.slice(2));
const fetchCache = new Map();

function parseCli(args) {
  const result = { manifest: '', output: 'console', help: false };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--manifest') {
      result.manifest = args[index + 1] || '';
      index += 1;
    } else if (argument === '--markdown') {
      result.output = 'markdown';
    } else if (argument === '--json') {
      result.output = 'json';
    } else if (argument === '--help' || argument === '-h') {
      result.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return result;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/check-malendo-verification-pages.mjs --manifest path/to/pages.json',
    '  node scripts/check-malendo-verification-pages.mjs --manifest path/to/pages.json --markdown',
    '  node scripts/check-malendo-verification-pages.mjs --manifest path/to/pages.json --json',
  ].join('\n');
}

function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function decodeEntities(value) {
  const named = {
    amp: '&', apos: "'", gt: '>', hellip: '...', laquo: '"', ldquo: '"',
    lsquo: "'", lt: '<', nbsp: ' ', ndash: '-', quot: '"', raquo: '"',
    rdquo: '"', rsquo: "'",
  };

  return String(value || '')
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCodePoint(Number.parseInt(number, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function visibleText(html) {
  return normalizeSpace(decodeEntities(String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')));
}

function parseAttributes(tag) {
  const attributes = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;

  while ((match = pattern.exec(tag)) !== null) {
    const name = match[1].toLowerCase();
    if (!name.startsWith('<')) {
      attributes[name] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
    }
  }

  return attributes;
}

function extractElements(html, tagName) {
  const elements = [];
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  let match;

  while ((match = pattern.exec(html)) !== null) {
    elements.push({ attributes: parseAttributes(match[1]), html: match[2], text: visibleText(match[2]) });
  }

  return elements;
}

function extractVoidElements(html, tagName) {
  const elements = [];
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>`, 'gi');
  let match;

  while ((match = pattern.exec(html)) !== null) {
    elements.push({ attributes: parseAttributes(match[1]) });
  }

  return elements;
}

function extractAnchors(html) {
  return extractElements(html, 'a').map((anchor) => ({
    href: anchor.attributes.href || '',
    className: anchor.attributes.class || '',
    attributes: anchor.attributes,
    text: anchor.text,
  }));
}

function classTokens(value) {
  return new Set(String(value || '').split(/\s+/).filter(Boolean));
}

function hasClass(value, className) {
  return classTokens(value).has(className);
}

function extractMetadata(html) {
  const title = extractElements(html, 'title')[0]?.text || '';
  const metas = extractVoidElements(html, 'meta');
  const links = extractVoidElements(html, 'link');
  const description = metas.find((meta) => (meta.attributes.name || '').toLowerCase() === 'description')?.attributes.content || '';
  const robots = metas.find((meta) => (meta.attributes.name || '').toLowerCase() === 'robots')?.attributes.content || '';
  const canonical = links.find((link) => classTokens((link.attributes.rel || '').toLowerCase()).has('canonical'))?.attributes.href || '';
  const headings = extractElements(html, 'h1');

  return { title, description: normalizeSpace(description), robots: normalizeSpace(robots), canonical, headings };
}

function redactUrl(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(value || '').split(/[?#]/)[0];
  }
}

function redactUrlWithHash(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}${url.hash}`;
  } catch {
    return String(value || '').split('?')[0];
  }
}

function safeUrl(value, base) {
  try {
    const url = new URL(value, base);
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function normalizedUrl(value, base, includeHash = true) {
  const url = safeUrl(value, base);
  if (!url) return '';
  const pathname = url.pathname === '/' ? '/' : `${url.pathname.replace(/\/+$/, '')}/`;
  return `${url.origin.toLowerCase()}${pathname}${includeHash ? url.hash : ''}`;
}

function robotsTokens(value) {
  return new Set(String(value || '').toLowerCase().split(/[\s,]+/).filter(Boolean));
}

function addCheck(result, severity, category, label, detail = '') {
  result.checks.push({ severity, category, label, detail });
}

function checkSummary(checks) {
  return checks.reduce((summary, check) => {
    summary[check.severity] += 1;
    return summary;
  }, { PASS: 0, SKIPPED: 0, WARNING: 0, FAIL: 0 });
}

async function fetchResource(url, options = {}) {
  const method = options.method || 'GET';
  const cacheKey = `${method}:${url}`;
  if (fetchCache.has(cacheKey)) return fetchCache.get(cacheKey);

  const promise = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method,
        redirect: 'follow',
        headers: {
          'user-agent': USER_AGENT,
          accept: options.accept || 'text/html,application/xhtml+xml,application/pdf;q=0.8,*/*;q=0.5',
          ...(options.range ? { range: 'bytes=0-4095' } : {}),
        },
        signal: controller.signal,
      });
      const body = method === 'HEAD' ? '' : await response.text();
      return { ok: true, status: response.status, finalUrl: response.url, body };
    } catch (error) {
      return { ok: false, status: 0, finalUrl: url, body: '', error: error.message };
    } finally {
      clearTimeout(timeout);
    }
  })();

  fetchCache.set(cacheKey, promise);
  return promise;
}

async function checkLinkedResource(url) {
  let response = await fetchResource(url, { method: 'HEAD' });
  if (response.ok && [405, 501].includes(response.status)) {
    response = await fetchResource(url, { method: 'GET', range: true });
  }
  return response;
}

function isAuthenticationResponse(pageUrl, response) {
  const requested = safeUrl(pageUrl);
  const final = safeUrl(response.finalUrl);
  const previewRequest = requested?.searchParams.has('preview') || requested?.searchParams.has('preview_id');
  const loginRedirect = final?.pathname.includes('/wp-login.php');
  const loginMarkup = /id=["']loginform["']|name=["']log["']|wp-submit/i.test(response.body);
  return [401, 403].includes(response.status) || loginRedirect || (previewRequest && loginMarkup);
}

function validateManifestEntry(entry, index) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error(`pages[${index}] must be an object`);
  }
  if (!normalizeSpace(entry.pageName)) throw new Error(`pages[${index}].pageName is required`);
  if (!safeUrl(entry.url)) throw new Error(`pages[${index}].url must be an absolute HTTP(S) URL`);

  for (const field of ['requiredInternalLinks', 'requiredCtaLinks', 'requiredSourceIds']) {
    if (entry[field] !== undefined && !Array.isArray(entry[field])) {
      throw new Error(`pages[${index}].${field} must be an array`);
    }
  }

  if (entry.requiresSources !== undefined && typeof entry.requiresSources !== 'boolean') {
    throw new Error(`pages[${index}].requiresSources must be true or false`);
  }

  const pageType = normalizeSpace(entry.pageType) || 'verification';
  const requiresSources = entry.requiresSources ?? true;
  const requiredSourceIds = entry.requiredSourceIds || [];

  if (!requiresSources && requiredSourceIds.length) {
    throw new Error(`pages[${index}] cannot set requiredSourceIds when requiresSources is false`);
  }
  if (!requiresSources && ['developer', 'project'].includes(pageType.toLowerCase())) {
    throw new Error(`pages[${index}].requiresSources cannot be false for ${pageType} pages`);
  }

  return {
    pageName: normalizeSpace(entry.pageName),
    url: entry.url,
    expectedTitle: normalizeSpace(entry.expectedTitle),
    expectedH1: normalizeSpace(entry.expectedH1),
    expectedRobots: normalizeSpace(entry.expectedRobots),
    expectedCanonical: entry.expectedCanonical || '',
    pageType,
    requiresSources,
    requiredInternalLinks: entry.requiredInternalLinks || [],
    requiredCtaLinks: entry.requiredCtaLinks || [],
    requiredSourceIds,
  };
}

function normalizeManifest(raw) {
  const parsed = JSON.parse(raw);
  const pages = Array.isArray(parsed) ? parsed : parsed.pages;
  const ordinaryPages = Array.isArray(parsed) ? [] : (parsed.ordinaryPages || []);

  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error('Manifest must contain a non-empty pages array');
  }
  if (!Array.isArray(ordinaryPages)) {
    throw new Error('ordinaryPages must be an array when provided');
  }

  return {
    pages: pages.map(validateManifestEntry),
    ordinaryPages: ordinaryPages.map((entry, index) => {
      const item = typeof entry === 'string' ? { pageName: `Ordinary page ${index + 1}`, url: entry } : entry;
      if (!item || !normalizeSpace(item.pageName) || !safeUrl(item.url)) {
        throw new Error(`ordinaryPages[${index}] requires pageName and an absolute HTTP(S) url`);
      }
      return { pageName: normalizeSpace(item.pageName), url: item.url };
    }),
  };
}

function classificationFindings(html, text) {
  return CLASSIFICATIONS.filter(([slug, label]) => (
    html.includes(`malendo-verification-box--${slug}`) ||
    new RegExp(`\\b${label.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)
  )).map(([, label]) => label);
}

function extractSourceTables(html) {
  return extractElements(html, 'table').filter((table) => hasClass(table.attributes.class, 'malendo-source-table'));
}

function extractCtaAnchors(anchors) {
  return anchors.filter((anchor) => (
    hasClass(anchor.className, 'malendo-verification-cta') ||
    Object.hasOwn(anchor.attributes, 'data-malendo-verification-cta')
  ));
}

function findDuplicateIds(html) {
  const counts = new Map();
  const markup = String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--([\s\S]*?)-->/g, '');
  const pattern = /\bid\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;
  let match;

  while ((match = pattern.exec(markup)) !== null) {
    const id = match[1] || match[2];
    counts.set(id, (counts.get(id) || 0) + 1);
  }

  return [...counts.entries()].filter(([, count]) => count > 1).map(([id, count]) => ({ id, count }));
}

function schemaTypes(html) {
  const types = [];
  const pattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    const typePattern = /["']@type["']\s*:\s*(?:["']([^"']+)["']|\[([^\]]+)\])/gi;
    let typeMatch;
    while ((typeMatch = typePattern.exec(match[1])) !== null) {
      if (typeMatch[1]) types.push(typeMatch[1]);
      if (typeMatch[2]) {
        types.push(...[...typeMatch[2].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]));
      }
    }
  }

  return [...new Set(types)];
}

function oldDomainFindings(html, anchors) {
  const findings = new Set();

  for (const anchor of anchors) {
    const url = safeUrl(anchor.href, 'https://malendo-property.com/');
    const host = url?.hostname.toLowerCase() || '';
    if (host === 'malendo.property' || host.endsWith('.malendo.property')) findings.add('malendo.property');
    if (host === 'drunkentiki.com' || host.endsWith('.drunkentiki.com')) findings.add('drunkentiki.com');
  }

  if (/https?:\/\/malendo\.property(?:[\s/"'<]|$)/i.test(html)) findings.add('malendo.property');
  if (/https?:\/\/(?:www\.)?drunkentiki\.com(?:[\s/"'<]|$)/i.test(html)) findings.add('drunkentiki.com');
  return [...findings];
}

function wordingFindings(text) {
  return UNSUPPORTED_WORDING.filter((item) => item.pattern.test(text)).map((item) => item.label);
}

function assignPageStatus(result) {
  if (result.unverifiable) return 'Unverifiable without authenticated preview';

  const failedCategories = new Set(result.checks.filter((check) => check.severity === 'FAIL').map((check) => check.category));
  if (failedCategories.has('indexing')) return 'Indexing/status unsafe';
  if (failedCategories.has('factual')) return 'Needs factual correction';
  if (failedCategories.has('source')) return 'Needs source correction';
  if (failedCategories.has('links')) return 'Missing CTA/internal links';
  if (failedCategories.has('formatting') || failedCategories.has('technical')) return 'Needs formatting correction';
  if (result.checks.some((check) => check.severity === 'WARNING')) return 'Keep Draft/noindex';
  return 'Ready for editorial approval';
}

async function auditPage(entry) {
  const result = {
    pageName: entry.pageName,
    pageType: entry.pageType,
    requiresSources: entry.requiresSources,
    url: redactUrl(entry.url),
    finalUrl: '',
    httpStatus: 0,
    status: '',
    unverifiable: false,
    metadata: {},
    classifications: [],
    sourceIds: [],
    sourceLinks: [],
    ctaLinks: [],
    checks: [],
  };
  const response = await fetchResource(entry.url);
  result.httpStatus = response.status;
  result.finalUrl = redactUrl(response.finalUrl);

  if (!response.ok) {
    addCheck(result, 'FAIL', 'technical', 'HTTP request failed', response.error || 'Unknown network error');
    result.status = assignPageStatus(result);
    result.summary = checkSummary(result.checks);
    return result;
  }

  if (isAuthenticationResponse(entry.url, response)) {
    result.unverifiable = true;
    addCheck(result, 'WARNING', 'preview', 'Authenticated preview required', `HTTP ${response.status}; public HTML checks were not attempted`);
    result.status = assignPageStatus(result);
    result.summary = checkSummary(result.checks);
    return result;
  }

  if (response.status !== 200) {
    addCheck(result, 'FAIL', 'technical', 'Page must return HTTP 200', `Received HTTP ${response.status}`);
  } else {
    addCheck(result, 'PASS', 'technical', 'HTTP status', 'HTTP 200');
  }

  const requestedComparable = normalizedUrl(entry.url, entry.url, false);
  const finalComparable = normalizedUrl(response.finalUrl, entry.url, false);
  if (requestedComparable && finalComparable && requestedComparable !== finalComparable) {
    addCheck(result, 'WARNING', 'technical', 'Final URL differs from requested URL', result.finalUrl);
  } else {
    addCheck(result, 'PASS', 'technical', 'Final URL', result.finalUrl);
  }

  const html = response.body;
  const text = visibleText(html);
  const metadata = extractMetadata(html);
  const anchors = extractAnchors(html);
  result.metadata = {
    title: metadata.title,
    metaDescription: metadata.description,
    h1Count: metadata.headings.length,
    h1Texts: metadata.headings.map((heading) => heading.text),
    robots: metadata.robots,
    canonical: metadata.canonical ? redactUrl(metadata.canonical) : '',
  };

  if (!metadata.title) {
    addCheck(result, 'FAIL', 'formatting', 'Title', 'Missing title');
  } else if (entry.expectedTitle && normalizeSpace(metadata.title) !== entry.expectedTitle) {
    addCheck(result, 'FAIL', 'formatting', 'Title', `Expected "${entry.expectedTitle}"; found "${metadata.title}"`);
  } else {
    addCheck(result, 'PASS', 'formatting', 'Title', metadata.title);
  }

  addCheck(result, metadata.description ? 'PASS' : 'FAIL', 'formatting', 'Meta description', metadata.description || 'Missing meta description');

  if (metadata.headings.length !== 1) {
    addCheck(result, 'FAIL', 'formatting', 'Exactly one H1', `Found ${metadata.headings.length}`);
  } else if (entry.expectedH1 && metadata.headings[0].text !== entry.expectedH1) {
    addCheck(result, 'FAIL', 'formatting', 'Expected H1', `Expected "${entry.expectedH1}"; found "${metadata.headings[0].text}"`);
  } else {
    addCheck(result, 'PASS', 'formatting', 'H1', metadata.headings[0].text);
  }

  const actualRobots = robotsTokens(metadata.robots);
  const expectedRobots = robotsTokens(entry.expectedRobots);
  const preApprovalRobotsSafe = actualRobots.has('noindex') && actualRobots.has('nofollow');
  addCheck(result, preApprovalRobotsSafe ? 'PASS' : 'FAIL', 'indexing', 'Public pre-approval robots safety', preApprovalRobotsSafe ? 'noindex,nofollow present' : `Expected noindex,nofollow; found: ${metadata.robots || '(none)'}`);
  if (!entry.expectedRobots) {
    addCheck(result, 'WARNING', 'indexing', 'Expected robots not configured', 'Set expectedRobots in the manifest; pre-approval pages should use noindex,nofollow');
  } else {
    const missingRobots = [...expectedRobots].filter((token) => !actualRobots.has(token));
    addCheck(result, missingRobots.length ? 'FAIL' : 'PASS', 'indexing', 'Robots meta', missingRobots.length ? `Missing: ${missingRobots.join(', ')}; found: ${metadata.robots || '(none)'}` : metadata.robots);
  }

  if (!metadata.canonical) {
    addCheck(result, 'FAIL', 'indexing', 'Canonical', 'Missing canonical');
  } else if (entry.expectedCanonical && normalizedUrl(metadata.canonical, response.finalUrl) !== normalizedUrl(entry.expectedCanonical, response.finalUrl)) {
    addCheck(result, 'FAIL', 'indexing', 'Canonical', `Expected ${redactUrl(entry.expectedCanonical)}; found ${redactUrl(metadata.canonical)}`);
  } else {
    addCheck(result, 'PASS', 'indexing', 'Canonical', redactUrl(metadata.canonical));
  }

  const lastChecked = html.match(/class=["'][^"']*malendo-last-checked[^"']*["'][\s\S]*?<time\b[^>]*datetime=["'](\d{4}-\d{2}-\d{2})["']/i);
  addCheck(result, lastChecked ? 'PASS' : 'FAIL', 'formatting', 'Last checked date', lastChecked?.[1] || 'Missing rendered last-checked block');

  const disclaimer = extractElements(html, 'aside').find((element) => hasClass(element.attributes.class, 'malendo-verification-disclaimer'));
  const disclaimerPresent = Boolean(disclaimer?.text);
  addCheck(result, disclaimerPresent ? 'PASS' : 'FAIL', 'formatting', 'Verification disclaimer', disclaimerPresent ? 'Present' : 'Missing or unrecognised disclaimer');

  result.classifications = classificationFindings(html, text);
  addCheck(result, result.classifications.length ? 'PASS' : 'FAIL', 'formatting', 'Verification classifications', result.classifications.join(', ') || 'No rendered classifications found');

  result.sourceIds = [...new Set([...text.matchAll(/\[S\d{2,}\]/gi)].map((match) => match[0].toUpperCase()))];
  const requiredSourceIds = entry.requiredSourceIds.map((id) => String(id).toUpperCase());
  const missingSourceIds = requiredSourceIds.filter((id) => !result.sourceIds.includes(id));
  const sourceTables = extractSourceTables(html);
  const sourceTableText = sourceTables.map((table) => table.text).join(' ').toUpperCase();
  const sourceAnchors = sourceTables.flatMap((table) => extractAnchors(table.html));
  const sourceUrls = [...new Set(sourceAnchors.map((anchor) => safeUrl(anchor.href, response.finalUrl)?.href).filter(Boolean))];
  result.sourceLinks = sourceUrls.map(redactUrl);

  if (!entry.requiresSources) {
    for (const label of ['Inline source IDs', 'Source table', 'Source-table links', 'Source IDs represented in source table', 'Source URL accessibility']) {
      addCheck(result, 'SKIPPED', 'source', label, 'Not required for this page type');
    }
  } else {
    if (missingSourceIds.length) {
      addCheck(result, 'FAIL', 'source', 'Required inline source IDs', `Missing: ${missingSourceIds.join(', ')}`);
    } else if (result.sourceIds.length) {
      addCheck(result, 'PASS', 'source', 'Inline source IDs', result.sourceIds.join(', '));
    } else {
      addCheck(result, 'FAIL', 'source', 'Inline source IDs', 'No [S00] source IDs found');
    }

    addCheck(result, sourceTables.length ? 'PASS' : 'FAIL', 'source', 'Source table', sourceTables.length ? `${sourceTables.length} table(s)` : 'Missing .malendo-source-table');
    addCheck(result, sourceUrls.length ? 'PASS' : 'FAIL', 'source', 'Source-table links', sourceUrls.length ? `${sourceUrls.length} HTTP(S) link(s)` : 'No HTTP(S) source links found');
    const sourceIdsMissingFromTable = requiredSourceIds.filter((id) => !sourceTableText.includes(id));
    addCheck(result, sourceIdsMissingFromTable.length ? 'FAIL' : 'PASS', 'source', 'Source IDs represented in source table', sourceIdsMissingFromTable.length ? `Missing from source table: ${sourceIdsMissingFromTable.join(', ')}` : `${requiredSourceIds.length} required source ID(s) represented`);

    if (!sourceUrls.length) {
      addCheck(result, 'FAIL', 'source', 'Source URL accessibility', 'No source URLs to check');
    }
    for (const sourceUrl of sourceUrls) {
      const sourceResponse = await checkLinkedResource(sourceUrl);
      const severity = sourceResponse.ok && sourceResponse.status >= 200 && sourceResponse.status < 400
        ? 'PASS'
        : (sourceResponse.ok && [401, 403, 429].includes(sourceResponse.status) ? 'WARNING' : 'FAIL');
      addCheck(result, severity, 'source', 'Source URL accessibility', `${redactUrl(sourceUrl)} -> ${sourceResponse.status || sourceResponse.error}`);
    }
  }

  const ctaAnchors = extractCtaAnchors(anchors);
  const ctaUrls = ctaAnchors.map((anchor) => safeUrl(anchor.href, response.finalUrl)).filter(Boolean);
  result.ctaLinks = ctaUrls.map((url) => redactUrlWithHash(url.href));
  addCheck(result, ctaUrls.length ? 'PASS' : 'FAIL', 'links', 'Verification CTA links', ctaUrls.length ? `${ctaUrls.length} CTA link(s)` : 'No rendered verification CTA links');

  for (const ctaUrl of ctaUrls) {
    const normalizedPath = ctaUrl.pathname === '/' ? '/' : `${ctaUrl.pathname.replace(/\/+$/, '')}/`;
    const approved = APPROVED_CTA_HOSTS.has(ctaUrl.hostname.toLowerCase()) && normalizedPath === APPROVED_CTA_PATH && ctaUrl.search === '' && APPROVED_CTA_HASHES.has(ctaUrl.hash);
    addCheck(result, approved ? 'PASS' : 'FAIL', 'links', 'Approved CTA host/path', approved ? redactUrlWithHash(ctaUrl.href) : `Not approved: ${redactUrlWithHash(ctaUrl.href)}`);
    const ctaResponse = await checkLinkedResource(ctaUrl.href.split('#')[0]);
    addCheck(result, ctaResponse.ok && ctaResponse.status >= 200 && ctaResponse.status < 400 ? 'PASS' : 'FAIL', 'links', 'CTA URL accessibility', `${redactUrl(ctaUrl.href)} -> ${ctaResponse.status || ctaResponse.error}`);
  }

  const renderedNormalizedLinks = new Set(anchors.map((anchor) => normalizedUrl(anchor.href, response.finalUrl)).filter(Boolean));
  const requiredCtaLinks = entry.requiredCtaLinks.map((url) => normalizedUrl(url, 'https://malendo-property.com/')).filter(Boolean);
  const requiredInternalLinks = entry.requiredInternalLinks.map((url) => normalizedUrl(url, response.finalUrl)).filter(Boolean);
  const missingCtaLinks = requiredCtaLinks.filter((url) => !renderedNormalizedLinks.has(url));
  const missingInternalLinks = requiredInternalLinks.filter((url) => !renderedNormalizedLinks.has(url));
  addCheck(result, missingCtaLinks.length ? 'FAIL' : 'PASS', 'links', 'Required CTA links', missingCtaLinks.length ? `Missing: ${missingCtaLinks.map(redactUrlWithHash).join(', ')}` : `${requiredCtaLinks.length} required link(s) present`);
  addCheck(result, missingInternalLinks.length ? 'FAIL' : 'PASS', 'links', 'Required internal links', missingInternalLinks.length ? `Missing: ${missingInternalLinks.map(redactUrl).join(', ')}` : `${requiredInternalLinks.length} required link(s) present`);

  for (const internalUrl of requiredInternalLinks) {
    const internalResponse = await checkLinkedResource(internalUrl.split('#')[0]);
    addCheck(result, internalResponse.ok && internalResponse.status >= 200 && internalResponse.status < 400 ? 'PASS' : 'FAIL', 'links', 'Internal link accessibility', `${redactUrl(internalUrl)} -> ${internalResponse.status || internalResponse.error}`);
  }

  const oldDomains = oldDomainFindings(html, anchors);
  addCheck(result, oldDomains.length ? 'FAIL' : 'PASS', 'factual', 'Old or unsafe domains', oldDomains.join(', ') || 'None');

  const rawShortcodes = [...new Set([...text.matchAll(/\[(?:\/?malendo_[a-z0-9_-]+)[^\]]*\]/gi)].map((match) => match[0]))];
  addCheck(result, rawShortcodes.length ? 'FAIL' : 'PASS', 'formatting', 'Raw shortcode leakage', rawShortcodes.join(', ') || 'None');

  const verificationCss = /verification-content\.css(?:[?"'])/i.test(html);
  const verificationJs = /verification-content\.js(?:[?"'])/i.test(html);
  addCheck(result, verificationCss ? 'PASS' : 'FAIL', 'technical', 'Verification CSS', verificationCss ? 'Present' : 'Missing');
  addCheck(result, verificationJs ? 'PASS' : 'FAIL', 'technical', 'Verification JavaScript', verificationJs ? 'Present' : 'Missing');

  const wrapperPresent = /class=["'][^"']*\bmalendo-verification-content\b[^"']*["']/i.test(html);
  addCheck(result, wrapperPresent ? 'PASS' : 'FAIL', 'formatting', 'Verification content wrapper', wrapperPresent ? 'Present' : 'Missing .malendo-verification-content wrapper');
  const tables = extractElements(html, 'table');
  const unstyledTables = tables.filter((table) => ![...classTokens(table.attributes.class)].some((className) => VERIFICATION_TABLE_CLASSES.has(className)));
  addCheck(result, unstyledTables.length ? 'FAIL' : 'PASS', 'formatting', 'Responsive table classes', unstyledTables.length ? `${unstyledTables.length} table(s) lack an approved verification class` : `${tables.length} table(s) use approved classes`);

  const duplicateIds = findDuplicateIds(html);
  addCheck(result, duplicateIds.length ? 'FAIL' : 'PASS', 'formatting', 'Duplicate heading/element IDs', duplicateIds.map((item) => `${item.id} (${item.count})`).join(', ') || 'None');

  const ga4Present = /G-D99Y7TY0LC|googletagmanager\.com\/gtag\/js/i.test(html);
  const leadEventsPresent = /lead-events\.js(?:[?"'])/i.test(html);
  addCheck(result, ga4Present ? 'PASS' : 'FAIL', 'technical', 'GA4 marker', ga4Present ? 'Present' : 'Missing');
  addCheck(result, leadEventsPresent ? 'PASS' : 'FAIL', 'technical', 'lead-events.js marker', leadEventsPresent ? 'Present' : 'Missing');

  const types = schemaTypes(html);
  const disallowedSchema = types.filter((type) => ['review', 'aggregaterating'].includes(type.toLowerCase()));
  addCheck(result, disallowedSchema.length ? 'FAIL' : 'PASS', 'indexing', 'Review/AggregateRating schema', disallowedSchema.join(', ') || 'None');

  const unsupported = wordingFindings(text);
  addCheck(result, unsupported.length ? 'FAIL' : 'PASS', 'factual', 'Unsupported guarantee/yield wording', unsupported.join(', ') || 'None');

  result.status = assignPageStatus(result);
  result.summary = checkSummary(result.checks);
  return result;
}

async function auditOrdinaryPage(entry) {
  const response = await fetchResource(entry.url);
  const result = {
    pageName: entry.pageName,
    url: redactUrl(entry.url),
    finalUrl: redactUrl(response.finalUrl),
    httpStatus: response.status,
    checks: [],
  };

  if (!response.ok || response.status !== 200) {
    addCheck(result, 'WARNING', 'ordinary-page', 'Ordinary page could not be verified', response.error || `HTTP ${response.status}`);
  } else {
    const cssPresent = /verification-content\.css(?:[?"'])/i.test(response.body);
    const jsPresent = /verification-content\.js(?:[?"'])/i.test(response.body);
    addCheck(result, cssPresent ? 'FAIL' : 'PASS', 'technical', 'Verification CSS absent', cssPresent ? 'Unexpectedly present' : 'Absent');
    addCheck(result, jsPresent ? 'FAIL' : 'PASS', 'technical', 'Verification JavaScript absent', jsPresent ? 'Unexpectedly present' : 'Absent');
  }

  result.summary = checkSummary(result.checks);
  return result;
}

function aggregateReport(pages, ordinaryPages) {
  const allChecks = [...pages, ...ordinaryPages].flatMap((item) => item.checks);
  const warnings = ordinaryPages.length ? [] : ['Ordinary page asset-scope checks are not configured.'];
  const summary = checkSummary(allChecks);
  summary.WARNING += warnings.length;
  return {
    generatedAt: new Date().toISOString(),
    manifest: path.basename(cli.manifest),
    summary,
    pageStatusCounts: pages.reduce((counts, page) => {
      counts[page.status] = (counts[page.status] || 0) + 1;
      return counts;
    }, {}),
    pages,
    ordinaryPages,
    warnings,
    approvedCta: {
      hosts: [...APPROVED_CTA_HOSTS],
      path: APPROVED_CTA_PATH,
      anchors: [...APPROVED_CTA_HASHES].filter(Boolean),
    },
  };
}

function markdownEscape(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function renderMarkdown(report) {
  const lines = [
    '# Malendo Verification Page QA',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '| PASS | SKIPPED | WARNING | FAIL |',
    '| ---: | ---: | ---: | ---: |',
    `| ${report.summary.PASS} | ${report.summary.SKIPPED} | ${report.summary.WARNING} | ${report.summary.FAIL} |`,
    '',
    '## Page Status',
    '',
    '| Page | Type | HTTP | Status |',
    '| --- | --- | ---: | --- |',
    ...report.pages.map((page) => `| ${markdownEscape(page.pageName)} | ${markdownEscape(page.pageType)} | ${page.httpStatus || '-'} | ${markdownEscape(page.status)} |`),
  ];

  for (const page of report.pages) {
    lines.push('', `## ${page.pageName}`, '', `- URL: ${page.url}`, `- Final URL: ${page.finalUrl || 'Unverified'}`, `- Status: **${page.status}**`, `- Sources required: ${page.requiresSources ? 'Yes' : 'No'}`);
    if (page.metadata.title !== undefined) {
      lines.push(`- Title: ${page.metadata.title || 'Missing'}`, `- H1: ${page.metadata.h1Texts?.join(' | ') || 'Missing'}`, `- Robots: ${page.metadata.robots || 'Missing'}`, `- Canonical: ${page.metadata.canonical || 'Missing'}`);
    }
    if (page.classifications.length) lines.push(`- Classifications: ${page.classifications.join(', ')}`);
    if (page.sourceIds.length) lines.push(`- Source IDs: ${page.sourceIds.join(', ')}`);
    lines.push('', '| Result | Check | Detail |', '| --- | --- | --- |');
    for (const check of page.checks) {
      lines.push(`| ${check.severity} | ${markdownEscape(check.label)} | ${markdownEscape(check.detail)} |`);
    }
  }

  lines.push('', '## Ordinary Page Asset Scope', '');
  if (!report.ordinaryPages.length) {
    lines.push('- Not configured. Add `ordinaryPages` to the manifest to verify verification CSS/JS absence.');
  } else {
    lines.push('| Page | HTTP | Result |', '| --- | ---: | --- |');
    for (const page of report.ordinaryPages) {
      const status = page.summary.FAIL ? 'FAIL' : (page.summary.WARNING ? 'WARNING' : 'PASS');
      lines.push(`| ${markdownEscape(page.pageName)} | ${page.httpStatus || '-'} | ${status} |`);
    }
  }

  if (report.warnings.length) {
    lines.push('', '## Report Warnings', '', ...report.warnings.map((warning) => `- ${warning}`));
  }

  lines.push('', '## Safety Notes', '', '- This report is read-only and submits no forms.', '- Query strings and fragments are redacted from reported page/source URLs.', '- Keep pages Draft/noindex until every factual, source, link, formatting and indexing check is resolved.', '- Authenticated previews are reported as unverifiable; the script does not accept or store WordPress credentials.');
  return lines.join('\n');
}

function renderConsole(report) {
  const lines = [
    'Malendo Verification Page QA',
    `PASS ${report.summary.PASS} | SKIPPED ${report.summary.SKIPPED} | WARNING ${report.summary.WARNING} | FAIL ${report.summary.FAIL}`,
    '',
  ];

  for (const page of report.pages) {
    lines.push(`${page.status}: ${page.pageName} (${page.httpStatus || 'no HTTP status'})`);
    for (const check of page.checks.filter((item) => item.severity !== 'PASS')) {
      lines.push(`  ${check.severity} ${check.label}: ${check.detail}`);
    }
  }

  if (!report.ordinaryPages.length) {
    lines.push('', 'WARNING Ordinary page asset-scope checks are not configured.');
  } else {
    lines.push('', 'Ordinary page asset scope:');
    for (const page of report.ordinaryPages) {
      lines.push(`  ${page.summary.FAIL ? 'FAIL' : (page.summary.WARNING ? 'WARNING' : 'PASS')} ${page.pageName}`);
    }
  }

  return lines.join('\n');
}

async function main() {
  if (cli.help) {
    console.log(usage());
    return;
  }
  if (!cli.manifest) throw new Error(`--manifest is required\n\n${usage()}`);

  const manifest = normalizeManifest(await readFile(cli.manifest, 'utf8'));
  const pages = [];
  const ordinaryPages = [];

  for (const entry of manifest.pages) pages.push(await auditPage(entry));
  for (const entry of manifest.ordinaryPages) ordinaryPages.push(await auditOrdinaryPage(entry));

  const report = aggregateReport(pages, ordinaryPages);
  if (cli.output === 'json') console.log(JSON.stringify(report, null, 2));
  else if (cli.output === 'markdown') console.log(renderMarkdown(report));
  else console.log(renderConsole(report));

  if (report.summary.FAIL > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Malendo verification page QA failed: ${error.message}`);
  process.exitCode = 1;
});
