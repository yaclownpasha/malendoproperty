#!/usr/bin/env node

const BASE_URL = 'https://malendo-property.com';
const TIMEOUT_MS = 15000;
const REQUEST_DELAY_MS = 650;
const MAX_REDIRECTS = 6;
const STOP_AFTER_TRANSIENTS = 3;
const INTERNAL_LINK_SAMPLE_LIMIT = 50;
const USER_AGENT = 'MalendoReadOnlyRecon/1.0 (+diagnostic; no forms)';
const outputMode = process.argv.includes('--internal-links-csv') ? 'internal-links-csv' : 'json';

const priorityPaths = [
  '/',
  '/thailand/phuket/services/property-management/',
  '/contact/',
  '/projects/',
  '/projects-thailand-phuket/',
  '/thailand/phuket/projects/',
  '/cart/',
  '/my-account/',
  '/request-phuket-project-check/',
  '/project-check-methodology-phuket/',
  '/projects/the-title-legendary-bang-tao-verification/',
  '/projects/laguna-lakeside-phuket-verification/',
  '/projects/the-base-bukit-phuket-verification/',
  '/robots.txt',
  '/sitemap_index.xml',
];

const projectPageIds = [27678283, 27678285, 27678290, 27678291, 27678292, 27678293];

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const fetchCache = new Map();

function decode(value) {
  return String(value ?? '')
    .replace(/&amp;|&#038;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function attr(tag, name) {
  const match = String(tag).match(new RegExp(`\\b${name}\\s*=\\s*(['"])([\\s\\S]*?)\\1`, 'i'));
  return match ? decode(match[2]).trim() : '';
}

function canonicalOf(html) {
  for (const match of String(html).matchAll(/<link\b[^>]*>/gi)) {
    if (attr(match[0], 'rel').toLowerCase().split(/\s+/).includes('canonical')) return attr(match[0], 'href');
  }
  return '';
}

function robotsOf(html) {
  for (const match of String(html).matchAll(/<meta\b[^>]*>/gi)) {
    if (attr(match[0], 'name').toLowerCase() === 'robots') return attr(match[0], 'content');
  }
  return '';
}

function sitemapLocations(xml) {
  return [...String(xml).matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)]
    .map((match) => decode(match[1]).trim())
    .filter(Boolean);
}

function internalLinksOf(html, pageUrl) {
  const links = [];
  for (const match of String(html).matchAll(/<a\b[^>]*>/gi)) {
    const href = attr(match[0], 'href');
    if (!href || /^(?:#|mailto:|tel:|javascript:)/i.test(href)) continue;
    try {
      const url = new URL(href, pageUrl);
      if (url.origin !== new URL(BASE_URL).origin) continue;
      if (/\/(?:wp-admin|wp-login\.php|wp-json)\b/i.test(url.pathname)) continue;
      if (url.search && /(?:\bs=|filter|orderby|add-to-cart|paged=)/i.test(url.search)) continue;
      url.search = '';
      url.hash = '';
      links.push(url.href);
    } catch {
      // Malformed links are recorded by the broader audit tools, not followed here.
    }
  }
  return [...new Set(links)].sort();
}

function liveFingerprints(html) {
  const text = String(html);
  return {
    ga4Id: (text.match(/G-[A-Z0-9]+/g) || []).filter((value, index, all) => all.indexOf(value) === index),
    gtmContainers: (text.match(/GTM-[A-Z0-9]+/g) || []).filter((value, index, all) => all.indexOf(value) === index),
    leadEvents: /lead-events\.js/i.test(text),
    verificationEvents: /verification-content\.js/i.test(text),
    contactForm7: /contact-form-7|wpcf7/i.test(text),
    cookieYes: /cookieyes|cdn-cookieyes|cky-/i.test(text),
    complianz: /complianz|cmplz/i.test(text),
    yandex: /yandex|mc\.yandex/i.test(text),
    chaty: /\/plugins\/chaty\/|\bchaty\b/i.test(text),
    wooCommerce: /\/plugins\/woocommerce\/|\bwoocommerce\b/i.test(text),
    hotelSync: /hotel[\s_-]*sync/i.test(text),
    otaSync: /ota[\s_-]*sync/i.test(text),
    bookingMarkers: /booking|reservation/i.test(text),
  };
}

function redactUrl(input) {
  try {
    const url = new URL(input, BASE_URL);
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return String(input).split(/[?#]/)[0];
  }
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

async function requestOnce(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.5',
        'user-agent': USER_AGENT,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchChain(input) {
  const cacheKey = redactUrl(new URL(input, BASE_URL).href);
  if (fetchCache.has(cacheKey)) return fetchCache.get(cacheKey);
  let current = new URL(input, BASE_URL).href;
  const chain = [];
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await sleep(REQUEST_DELAY_MS);
    try {
      const response = await requestOnce(current);
      const location = response.headers.get('location');
      const body = await response.text();
      chain.push({
        url: redactUrl(current),
        status: response.status,
        location: location ? redactUrl(new URL(location, current).href) : '',
        server: response.headers.get('server') || '',
        redirectBy: response.headers.get('x-redirect-by') || '',
        cacheStatus: response.headers.get('cf-cache-status') || response.headers.get('x-cache') || '',
      });
      if (response.status >= 300 && response.status < 400 && location) {
        current = new URL(location, current).href;
        continue;
      }
      const result = {
        requestedUrl: redactUrl(input),
        status: response.status,
        finalUrl: redactUrl(current),
        redirectChain: chain,
        contentType: response.headers.get('content-type') || '',
        responseHeaders: {
          server: response.headers.get('server') || '',
          redirectBy: response.headers.get('x-redirect-by') || '',
          poweredBy: response.headers.get('x-powered-by') || '',
          cacheStatus: response.headers.get('cf-cache-status') || response.headers.get('x-cache') || '',
        },
        canonical: canonicalOf(body),
        robots: robotsOf(body),
        body,
        transportFailure: '',
      };
      fetchCache.set(cacheKey, result);
      return result;
    } catch (error) {
      return {
        requestedUrl: redactUrl(input),
        status: 0,
        finalUrl: redactUrl(current),
        redirectChain: chain,
        contentType: '',
        responseHeaders: {},
        canonical: '',
        robots: '',
        body: '',
        transportFailure: error?.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : String(error?.message ?? error),
      };
    }
  }
  return {
    requestedUrl: redactUrl(input),
    status: 0,
    finalUrl: redactUrl(current),
    redirectChain: chain,
    contentType: '',
    responseHeaders: {},
    canonical: '',
    robots: '',
    body: '',
    transportFailure: `redirect limit exceeded (${MAX_REDIRECTS})`,
  };
}

function publicRecord(result, source = 'priority-set') {
  return {
    source,
    requestedUrl: result.requestedUrl,
    status: result.status,
    finalUrl: result.finalUrl,
    redirectChain: result.redirectChain,
    canonical: redactUrl(result.canonical),
    robots: result.robots,
    contentType: result.contentType,
    responseHeaders: result.responseHeaders,
    transportFailure: result.transportFailure,
    internalLinks: /text\/html/i.test(result.contentType) ? internalLinksOf(result.body, result.finalUrl) : [],
    liveFingerprints: /text\/html/i.test(result.contentType) ? liveFingerprints(result.body) : null,
    textBody: /text\/plain/i.test(result.contentType) ? result.body.slice(0, 12000) : '',
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const priority = [];
  let consecutiveTransients = 0;

  for (const path of priorityPaths) {
    const result = await fetchChain(path);
    priority.push(publicRecord(result));
    const transient = result.status === 429 || result.status >= 500 || Boolean(result.transportFailure);
    consecutiveTransients = transient ? consecutiveTransients + 1 : 0;
    if (consecutiveTransients >= STOP_AFTER_TRANSIENTS) break;
  }

  const sitemapIndex = priority.find((item) => item.requestedUrl.endsWith('/sitemap_index.xml'));
  const sitemapChildren = [];
  if (sitemapIndex?.status === 200) {
    const indexResult = await fetchChain('/sitemap_index.xml');
    for (const location of sitemapLocations(indexResult.body)) {
      const result = await fetchChain(location);
      sitemapChildren.push({
        ...publicRecord(result, 'sitemap-index'),
        urlCount: result.status === 200 ? sitemapLocations(result.body).length : null,
      });
      const transient = result.status === 429 || result.status >= 500 || Boolean(result.transportFailure);
      consecutiveTransients = transient ? consecutiveTransients + 1 : 0;
      if (consecutiveTransients >= STOP_AFTER_TRANSIENTS) break;
    }
  }

  const projectRest = [];
  for (const pageId of projectPageIds) {
    const result = await fetchChain(`/wp-json/wp/v2/pages/${pageId}`);
    let metadata = null;
    if (result.status === 200) {
      try {
        const item = JSON.parse(result.body);
        metadata = {
          id: item.id,
          status: item.status,
          parent: item.parent,
          slug: item.slug,
          link: redactUrl(item.link),
          modifiedGmt: item.modified_gmt,
          title: item.title?.rendered || '',
          yoastCanonical: redactUrl(item.yoast_head_json?.canonical || ''),
          yoastRobots: item.yoast_head_json?.robots || null,
        };
      } catch {
        metadata = { parseError: 'Public REST response was not valid JSON' };
      }
    }
    projectRest.push({ ...publicRecord(result, 'public-rest'), pageId, metadata });
  }

  const sourceTargets = new Map();
  for (const page of priority) {
    for (const target of page.internalLinks) {
      if (!sourceTargets.has(target)) sourceTargets.set(target, new Set());
      sourceTargets.get(target).add(page.finalUrl);
    }
  }
  const internalLinkTargets = [...sourceTargets.keys()].sort();
  const sampledInternalTargets = internalLinkTargets.slice(0, INTERNAL_LINK_SAMPLE_LIMIT);
  const internalLinkChecks = [];
  for (const target of sampledInternalTargets) {
    const result = await fetchChain(target);
    internalLinkChecks.push({
      sources: [...sourceTargets.get(target)].sort(),
      ...publicRecord(result, 'internal-link-sample'),
    });
    const transient = result.status === 429 || result.status >= 500 || Boolean(result.transportFailure);
    consecutiveTransients = transient ? consecutiveTransients + 1 : 0;
    if (consecutiveTransients >= STOP_AFTER_TRANSIENTS) break;
  }

  const output = {
    meta: {
      startedAt,
      completedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      mode: 'read-only',
      concurrency: 1,
      requestDelayMs: REQUEST_DELAY_MS,
      formsSubmitted: false,
      authenticated: false,
      stoppedEarly: consecutiveTransients >= STOP_AFTER_TRANSIENTS,
    },
    priority,
    sitemapChildren,
    projectRest,
    internalLinkSampling: {
      discoveredTargets: internalLinkTargets.length,
      sampleLimit: INTERNAL_LINK_SAMPLE_LIMIT,
      checkedTargets: internalLinkChecks.length,
      untestedTargets: Math.max(0, internalLinkTargets.length - internalLinkChecks.length),
    },
    internalLinkChecks,
  };

  if (outputMode === 'internal-links-csv') {
    const headers = ['Source URL', 'Target URL', 'HTTP status', 'Final URL', 'Redirect chain', 'Canonical', 'Robots', 'Issue category', 'Confidence', 'Evidence timestamp', 'Coverage'];
    console.log(headers.map(csvCell).join(','));
    for (const item of internalLinkChecks) {
      const issue = item.transportFailure
        ? 'transport failure'
        : item.status >= 500
          ? 'server error'
          : item.status >= 400
            ? 'broken target'
            : item.redirectChain.length > 2
              ? 'long redirect chain'
              : item.redirectChain.length > 1
                ? 'redirect'
                : 'none detected';
      console.log([
        item.sources,
        item.requestedUrl,
        item.status,
        item.finalUrl,
        item.redirectChain.map((hop) => `${hop.status} ${hop.url}${hop.location ? ` -> ${hop.location}` : ''}`),
        item.canonical,
        item.robots,
        issue,
        item.transportFailure ? 'low' : 'high',
        output.meta.completedAt,
        'checked in deterministic sample',
      ].map(csvCell).join(','));
    }
    for (const target of internalLinkTargets.slice(internalLinkChecks.length)) {
      console.log([
        [...sourceTargets.get(target)].sort(),
        target,
        '',
        '',
        '',
        '',
        '',
        'not tested',
        'none',
        output.meta.completedAt,
        'discovered but outside 50-target sample; not a PASS',
      ].map(csvCell).join(','));
    }
    return;
  }

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(`Recon runtime failure: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
