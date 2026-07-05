#!/usr/bin/env node

const BASE_URL = 'https://malendo-property.com';
const TIMEOUT_MS = 25000;
const META_TIMEOUT_MS = 12000;
const CONCURRENCY = 8;
const LIMITS = {
  warning: 250 * 1024,
  high: 500 * 1024,
  critical: 1024 * 1024,
};

const seedPages = [
  '/',
  '/properties/',
  '/contact/',
  '/submit-your-application/',
  '/rent-property/rent-villas/',
  '/rent-property/rent-apartment/',
  '/sell-property/sell-apartment/',
  '/thailand/phuket/services/property-management/',
];

const fallbackEstatePages = [
  '/properties/thailand/phuket/rent/carla-villa/',
  '/properties/thailand/phuket/rent/batterfly/',
  '/properties/thailand/phuket/rent/the-kris/',
  '/properties/thailand/phuket/sell/kata-sea-view-villas/',
  '/properties/thailand/phuket/sell/bright-condo-bangtao/',
];

const mode = process.argv.includes('--json') ? 'json' : process.argv.includes('--markdown') ? 'markdown' : 'console';

function decode(value) {
  return String(value ?? '')
    .replace(/&amp;/gi, '&')
    .replace(/&#038;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .trim();
}

function absolute(value, base = BASE_URL) {
  try {
    return new URL(decode(value), base).href;
  } catch {
    return '';
  }
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(['"])(.*?)\\1`, 'i'));
  return match ? decode(match[2]) : '';
}

function display(url) {
  try {
    const parsed = new URL(url, BASE_URL);
    return parsed.origin === BASE_URL ? `${parsed.pathname}${parsed.search}` : parsed.href;
  } catch {
    return url;
  }
}

function normalize(url) {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.href;
  } catch {
    return url;
  }
}

function imageType(url) {
  try {
    return new URL(url).pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || 'unknown';
  } catch {
    return 'unknown';
  }
}

function isImage(url) {
  return /\.(avif|webp|jpe?g|png|gif|svg)(\?|#|$)/i.test(url);
}

function sizeLabel(bytes) {
  if (!bytes) return 'unknown';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

function severity(bytes) {
  if (!bytes) return 'unknown';
  if (bytes >= LIMITS.critical) return 'critical';
  if (bytes >= LIMITS.high) return 'high';
  if (bytes >= LIMITS.warning) return 'warning';
  return 'ok';
}

function srcsetUrls(value, baseUrl) {
  return decode(value)
    .split(',')
    .map((part) => absolute(part.trim().split(/\s+/)[0], baseUrl))
    .filter((url) => url && isImage(url));
}

async function fetchWithTimeout(url, options = {}, timeout = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'MalendoImageAudit/1.0 (+read-only)', ...(options.headers || {}) },
      ...options,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHtml(url) {
  const response = await fetchWithTimeout(url);
  return {
    status: response.status,
    finalUrl: response.url,
    html: await response.text(),
  };
}

async function fetchImageMeta(url) {
  try {
    let response = await fetchWithTimeout(url, { method: 'HEAD' }, META_TIMEOUT_MS);
    if (!response.ok || !response.headers.get('content-length')) {
      response = await fetchWithTimeout(url, { method: 'GET', headers: { range: 'bytes=0-0' } }, META_TIMEOUT_MS);
    }
    const rangeSize = response.headers.get('content-range')?.match(/\/(\d+)$/)?.[1];
    const length = rangeSize || response.headers.get('content-length') || '0';
    return {
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      bytes: Number(length) || 0,
      error: '',
    };
  } catch (error) {
    return {
      status: 0,
      contentType: '',
      bytes: 0,
      error: error?.name === 'AbortError' ? 'timeout' : String(error?.message || error),
    };
  }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function addImage(candidates, html, url, source, tag, index, baseUrl) {
  const absoluteUrl = absolute(url, baseUrl);
  if (!absoluteUrl || !isImage(absoluteUrl)) return;
  const loading = attr(tag, 'loading').toLowerCase() || 'not specified';
  const ratio = index >= 0 && html.length ? index / html.length : 1;
  candidates.push({
    url: absoluteUrl,
    normalizedUrl: normalize(absoluteUrl),
    source,
    loading,
    alt: attr(tag, 'alt'),
    htmlPositionRatio: Number(ratio.toFixed(3)),
    possibleHero: ratio < 0.35 && loading !== 'lazy',
  });
}

function extractImages(html, baseUrl) {
  const candidates = [];
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    addImage(candidates, html, attr(tag, 'src'), 'img src', tag, match.index, baseUrl);
    addImage(candidates, html, attr(tag, 'data-src'), 'img data-src', tag, match.index, baseUrl);
    addImage(candidates, html, attr(tag, 'data-lazy-src'), 'img data-lazy-src', tag, match.index, baseUrl);
    for (const url of srcsetUrls(attr(tag, 'srcset'), baseUrl)) addImage(candidates, html, url, 'img srcset', tag, match.index, baseUrl);
    for (const url of srcsetUrls(attr(tag, 'data-srcset'), baseUrl)) addImage(candidates, html, url, 'img data-srcset', tag, match.index, baseUrl);
  }
  for (const match of html.matchAll(/<source\b[^>]*>/gi)) {
    for (const url of srcsetUrls(attr(match[0], 'srcset'), baseUrl)) addImage(candidates, html, url, 'source srcset', match[0], match.index, baseUrl);
  }
  for (const match of html.matchAll(/url\((['"]?)(.*?)\1\)/gi)) {
    addImage(candidates, html, match[2], 'css url()', '', match.index, baseUrl);
  }

  const unique = new Map();
  for (const image of candidates) {
    const existing = unique.get(image.normalizedUrl);
    if (!existing) {
      unique.set(image.normalizedUrl, image);
    } else {
      existing.source = Array.from(new Set(`${existing.source}, ${image.source}`.split(', '))).join(', ');
      existing.possibleHero = existing.possibleHero || image.possibleHero;
      existing.htmlPositionRatio = Math.min(existing.htmlPositionRatio, image.htmlPositionRatio);
      if (existing.loading === 'not specified' && image.loading !== 'not specified') existing.loading = image.loading;
    }
  }
  return Array.from(unique.values());
}

function extractEstateLinks(html, baseUrl) {
  const links = new Set();
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*(['"])(.*?)\1/gi)) {
    const url = absolute(match[2], baseUrl);
    if (!url) continue;
    const parsed = new URL(url);
    if (parsed.origin === BASE_URL && /^\/properties\/thailand\/phuket\/(rent|sell)\/[^/]+\/?$/i.test(parsed.pathname)) {
      links.add(parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`);
    }
  }
  return links;
}

async function discoverEstatePages() {
  const links = new Set();
  for (const path of ['/', '/properties/']) {
    try {
      const page = await fetchHtml(absolute(path));
      for (const link of extractEstateLinks(page.html, page.finalUrl)) links.add(link);
    } catch {
      // Fall back below.
    }
  }
  for (const fallback of fallbackEstatePages) {
    if (links.size >= 5) break;
    links.add(fallback);
  }
  return Array.from(links).slice(0, 5);
}

function typeSummary(images) {
  const summary = {};
  for (const image of images) summary[image.extension] = (summary[image.extension] || 0) + 1;
  return summary;
}

function pageIssueSummary(page) {
  const bits = [];
  if (page.over1mb) bits.push(`${page.over1mb} critical >1 MB`);
  if (page.over500kb) bits.push(`${page.over500kb} high >500 KB`);
  if (page.over250kb) bits.push(`${page.over250kb} warning >250 KB`);
  return bits.length ? bits.join(', ') : 'none';
}

async function audit() {
  const pagePaths = Array.from(new Set([...seedPages, ...(await discoverEstatePages())]));
  const rawPages = [];
  for (const path of pagePaths) {
    const page = await fetchHtml(absolute(path));
    rawPages.push({ path, url: page.finalUrl, status: page.status, images: extractImages(page.html, page.finalUrl) });
  }

  const imageByUrl = new Map();
  for (const page of rawPages) for (const image of page.images) imageByUrl.set(image.normalizedUrl, image.url);
  const metaEntries = await mapLimit(Array.from(imageByUrl.entries()), CONCURRENCY, async ([normalizedUrl, url]) => [normalizedUrl, await fetchImageMeta(url)]);
  const metaByUrl = new Map(metaEntries);
  const usage = new Map();

  const pages = rawPages.map((page) => {
    const images = page.images.map((image) => {
      const meta = metaByUrl.get(image.normalizedUrl) || {};
      const full = {
        ...image,
        extension: imageType(image.url),
        contentType: meta.contentType || '',
        bytes: meta.bytes || 0,
        size: sizeLabel(meta.bytes || 0),
        severity: severity(meta.bytes || 0),
        headStatus: meta.status || 0,
        metaError: meta.error || '',
      };
      const item = usage.get(full.normalizedUrl) || { url: full.url, bytes: full.bytes, pages: new Set() };
      item.bytes = Math.max(item.bytes || 0, full.bytes || 0);
      item.pages.add(page.url);
      usage.set(full.normalizedUrl, item);
      return full;
    });
    return {
      url: page.url,
      path: page.path,
      status: page.status,
      imageCount: images.length,
      images,
      largestImages: images.filter((image) => image.bytes > 0).sort((a, b) => b.bytes - a.bytes).slice(0, 5),
      heroCandidates: images.filter((image) => image.possibleHero).slice(0, 5),
      over250kb: images.filter((image) => image.bytes >= LIMITS.warning).length,
      over500kb: images.filter((image) => image.bytes >= LIMITS.high).length,
      over1mb: images.filter((image) => image.bytes >= LIMITS.critical).length,
      lazyCount: images.filter((image) => image.loading === 'lazy').length,
      notLazyCount: images.filter((image) => image.loading !== 'lazy').length,
    };
  });

  const allImages = pages.flatMap((page) => page.images.map((image) => ({ ...image, page: page.url })));
  const largeImages = allImages.filter((image) => image.bytes >= LIMITS.warning).sort((a, b) => b.bytes - a.bytes);
  const repeatedLargeImages = Array.from(usage.values())
    .filter((image) => image.bytes >= LIMITS.warning && image.pages.size > 1)
    .sort((a, b) => b.bytes - a.bytes)
    .map((image) => ({ url: image.url, bytes: image.bytes, extension: imageType(image.url), pages: Array.from(image.pages), severity: severity(image.bytes) }));

  return {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    thresholds: { warningBytes: LIMITS.warning, highBytes: LIMITS.high, criticalBytes: LIMITS.critical },
    auditedPages: pagePaths,
    totals: {
      pages: pages.length,
      uniqueImages: metaByUrl.size,
      imageReferences: allImages.length,
      warningImages: largeImages.filter((image) => image.bytes < LIMITS.high).length,
      highImages: largeImages.filter((image) => image.bytes >= LIMITS.high && image.bytes < LIMITS.critical).length,
      criticalImages: largeImages.filter((image) => image.bytes >= LIMITS.critical).length,
    },
    pages,
    findings: {
      allImages,
      largestImages: allImages.filter((image) => image.bytes > 0).sort((a, b) => b.bytes - a.bytes).slice(0, 20),
      largeImages,
      repeatedLargeImages,
      typeSummary: typeSummary(allImages),
      lazy: {
        lazy: allImages.filter((image) => image.loading === 'lazy').length,
        eager: allImages.filter((image) => image.loading === 'eager').length,
        notSpecified: allImages.filter((image) => image.loading === 'not specified').length,
      },
    },
    recommendedWpAdminActions: [
      'Compress or replace images over 500 KB first, especially homepage and hero-style images.',
      'Serve JPG/PNG photos as WebP or AVIF where the media optimization plugin supports it.',
      'Keep property photos attractive; do not overcompress listing images that users need to inspect.',
      'Use appropriately cropped hero images instead of uploading full camera-size originals.',
      'Keep lazy loading for below-the-fold listing and gallery images, but do not lazy-load the primary above-the-fold hero if it hurts perceived load.',
    ],
    recommendedCodexTasks: [
      'No immediate code change is required from this audit alone.',
      'Consider a future PR only if the audit shows missing width/height, broken lazy-loading markup, or a clearly safe preload/resource-hint opportunity.',
    ],
  };
}

function markdown(report) {
  const lines = [
    '# Malendo Image Optimization Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Executive Summary',
    '',
    `- Pages audited: ${report.totals.pages}`,
    `- Unique image URLs checked: ${report.totals.uniqueImages}`,
    `- Image references found: ${report.totals.imageReferences}`,
    `- Images 250-500 KB: ${report.totals.warningImages}`,
    `- Images 500 KB-1 MB: ${report.totals.highImages}`,
    `- Images over 1 MB: ${report.totals.criticalImages}`,
    '',
    '## Biggest Image Offenders',
    '',
  ];

  const offenders = report.findings.largestImages.filter((image) => image.bytes >= LIMITS.warning).slice(0, 15);
  if (offenders.length) {
    lines.push('| Severity | Size | Type | Page | Image |', '| --- | ---: | --- | --- | --- |');
    for (const image of offenders) lines.push(`| ${image.severity} | ${sizeLabel(image.bytes)} | ${image.extension} | ${display(image.page)} | ${display(image.url)} |`);
  } else {
    lines.push('- None over 250 KB found in the audited sample.');
  }

  lines.push('', '## Per-Page Image Table', '');
  lines.push('| Page | Status | Images | Lazy | Not lazy/unknown | Largest image | Size warnings |', '| --- | ---: | ---: | ---: | ---: | --- | --- |');
  for (const page of report.pages) {
    const largest = page.largestImages[0];
    lines.push(`| ${display(page.url)} | ${page.status} | ${page.imageCount} | ${page.lazyCount} | ${page.notLazyCount} | ${largest ? `${display(largest.url)} (${largest.size})` : 'none'} | ${pageIssueSummary(page)} |`);
  }

  lines.push('', '## Large Homepage / Hero Candidates', '');
  const heroes = report.pages
    .flatMap((page) => page.heroCandidates.map((image) => ({ ...image, page: page.url })))
    .filter((image) => image.bytes >= LIMITS.warning)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 12);
  if (heroes.length) {
    lines.push('| Page | Image | Size | Loading |', '| --- | --- | ---: | --- |');
    for (const image of heroes) lines.push(`| ${display(image.page)} | ${display(image.url)} | ${image.size} | ${image.loading} |`);
  } else {
    lines.push('- No above-the-fold/hero candidates over 250 KB were detected.');
  }

  lines.push('', '## WebP / AVIF Usage Summary', '', '| Type | Count |', '| --- | ---: |');
  for (const [type, count] of Object.entries(report.findings.typeSummary).sort((a, b) => b[1] - a[1])) lines.push(`| ${type} | ${count} |`);

  lines.push('', '## Lazy-Load Findings', '');
  lines.push(`- Images with \`loading="lazy"\`: ${report.findings.lazy.lazy}`);
  lines.push(`- Images with \`loading="eager"\`: ${report.findings.lazy.eager}`);
  lines.push(`- Images without detectable loading attribute: ${report.findings.lazy.notSpecified}`);

  lines.push('', '## Repeated Large Images', '');
  if (report.findings.repeatedLargeImages.length) {
    lines.push('| Size | Image | Pages |', '| ---: | --- | --- |');
    for (const image of report.findings.repeatedLargeImages.slice(0, 12)) lines.push(`| ${sizeLabel(image.bytes)} | ${display(image.url)} | ${image.pages.map(display).join('<br>')} |`);
  } else {
    lines.push('- No repeated images over 250 KB were detected across multiple audited pages.');
  }

  lines.push('', '## WP-Admin / Media Actions', '');
  for (const action of report.recommendedWpAdminActions) lines.push(`- ${action}`);
  lines.push('', '## What Should Not Be Overcompressed', '');
  lines.push('- Do not overcompress property gallery photos where buyers or renters need to inspect room quality, views, furniture, and finishes.');
  lines.push('- Do not replace high-value listing images with blurry thumbnails.');
  lines.push('- Do not lazy-load the primary hero image blindly; test perceived load and layout shift first.');
  lines.push('- Do not bulk delete uploads or regenerate all thumbnails without backup and a rollback plan.');
  lines.push('', '## Codex / Git Action Needed?', '');
  for (const action of report.recommendedCodexTasks) lines.push(`- ${action}`);
  return lines.join('\n');
}

function consoleReport(report) {
  const lines = [
    'Malendo Image Optimization Audit',
    `Generated: ${report.generatedAt}`,
    `Pages audited: ${report.totals.pages}`,
    `Unique images checked: ${report.totals.uniqueImages}`,
    `Large images: ${report.totals.warningImages} warning, ${report.totals.highImages} high, ${report.totals.criticalImages} critical`,
    '',
    'Largest images:',
  ];
  for (const image of report.findings.largestImages.slice(0, 10)) lines.push(`- [${image.severity}] ${sizeLabel(image.bytes)} ${display(image.url)} on ${display(image.page)}`);
  lines.push('', 'Per page:');
  for (const page of report.pages) {
    const largest = page.largestImages[0];
    lines.push(`- ${display(page.url)}: ${page.imageCount} images; largest ${largest ? `${largest.size} ${display(largest.url)}` : 'none'}; warnings ${pageIssueSummary(page)}`);
  }
  return lines.join('\n');
}

try {
  const report = await audit();
  if (mode === 'json') console.log(JSON.stringify(report, null, 2));
  else if (mode === 'markdown') console.log(markdown(report));
  else console.log(consoleReport(report));
} catch (error) {
  console.error(`Image audit failed: ${error?.stack || error}`);
  process.exitCode = 1;
}
