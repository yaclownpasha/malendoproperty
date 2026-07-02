#!/usr/bin/env node

const BASE_URL = 'https://malendo-property.com';
const TIMEOUT_MS = 25000;
const IMAGE_HEAD_LIMIT = 10;

const pagesToAudit = [
  '/',
  '/contact/',
  '/submit-your-application/',
  '/properties/',
  '/rent-property/rent-villas/',
  '/rent-property/rent-apartment/',
  '/sell-property/sell-apartment/',
  '/sell-property/sell-bungalow/',
  '/sell-property/sell-warehouse-factory/',
  '/thailand/phuket/services/property-management/',
];

const keywords = ['Phuket', 'real estate', 'property', 'rent', 'sale', 'villa', 'apartment', 'condo', 'property management'];
const legacyStrings = ['Malendo.property', 'malendo.property', 'info@malendo.property', '2025 by Malendo'];
const leadNeedles = ['contact', 'submit', 'application', 'sell-property', 'rent-property'];
const badExternalPattern = /drunkentiki|casino|gambl|betting|poker|porn|adult|viagra|loan/i;

const pluginRules = [
  ['myhome', 'MyHome theme/assets', /myhome|\/themes\/myhome/i],
  ['wpbakery', 'WPBakery / Visual Composer', /js_composer|wpbakery|\bvc_/i],
  ['woocommerce', 'WooCommerce', /woocommerce|\bwc-|add-to-cart/i],
  ['contact-form-7', 'Contact Form 7', /contact-form-7|wpcf7/i],
  ['revslider', 'Slider Revolution / RevSlider', /revslider|\brs6|revolution/i],
  ['easy-social-share-buttons', 'Easy Social Share Buttons', /easy-social-share-buttons|essb/i],
  ['chaty', 'Chaty', /chaty/i],
  ['cookieyes', 'CookieYes', /cookieyes|\bcky-|cookie-law-info/i],
  ['gtranslate', 'GTranslate', /gtranslate/i],
  ['font-awesome', 'Font Awesome / icon libraries', /font-?awesome|fontawesome|\/fa-/i],
  ['google-analytics', 'Google Analytics / gtag', /googletagmanager|gtag|google-analytics|G-D99Y7TY0LC/i],
  ['yandex', 'Yandex', /yandex/i],
];

const args = process.argv.slice(2);
const mode = args.includes('--json') ? 'json' : args.includes('--markdown') ? 'markdown' : 'console';
const headCache = new Map();

function abs(pathOrUrl) {
  return pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE_URL}${pathOrUrl}`;
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function escMd(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function trunc(value, max = 110) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function decode(text) {
  return String(text ?? '')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&#x2F;|&#47;/gi, '/')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function textOnly(html) {
  return decode(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tags(html, name) {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(['"])(.*?)\\1`, 'i'));
  return match ? decode(match[2].trim()) : '';
}

function titleOf(html) {
  return textOnly((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) ?? [])[1] ?? '');
}

function meta(html, wanted) {
  for (const tag of tags(html, 'meta')) {
    const name = attr(tag, 'name').toLowerCase();
    const property = attr(tag, 'property').toLowerCase();
    if (name === wanted.toLowerCase() || property === wanted.toLowerCase()) {
      return attr(tag, 'content');
    }
  }
  return '';
}

function canonicalOf(html) {
  const tag = tags(html, 'link').find((item) => /\brel\s*=\s*['"][^'"]*canonical/i.test(item));
  return tag ? attr(tag, 'href') : '';
}

function h1s(html) {
  return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => textOnly(match[1])).filter(Boolean);
}

function jsonLdTypes(html) {
  const found = new Set();
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      collectTypes(JSON.parse(match[1].trim()), found);
    } catch {
      // Advisory only.
    }
  }
  return [...found].sort();
}

function collectTypes(value, found) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectTypes(item, found));
    return;
  }
  if (!value || typeof value !== 'object') return;
  const type = value['@type'];
  if (Array.isArray(type)) type.forEach((item) => found.add(String(item)));
  else if (type) found.add(String(type));
  Object.values(value).forEach((item) => collectTypes(item, found));
}

function links(html) {
  const output = [];
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(['"])(.*?)\1[\s\S]*?<\/a>/gi)) {
    const href = decode(match[2].trim());
    if (!href || href.startsWith('#') || /^javascript:/i.test(href)) continue;
    let absolute = '';
    try {
      absolute = new URL(href, BASE_URL).href;
    } catch {
      absolute = href;
    }
    output.push({ href, absolute, text: trunc(textOnly(match[0]), 80) });
  }
  return uniqueObjects(output, (item) => `${item.href}|${item.text}`);
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

function assets(html) {
  const css = uniq(tags(html, 'link')
    .filter((tag) => /\brel\s*=\s*['"][^'"]*stylesheet/i.test(tag))
    .map((tag) => safeUrl(attr(tag, 'href'))));
  const js = uniqueObjects(tags(html, 'script')
    .map((tag) => ({ src: safeUrl(attr(tag, 'src')), async: /\basync\b/i.test(tag), defer: /\bdefer\b/i.test(tag) }))
    .filter((item) => item.src), (item) => item.src);
  const imageUrls = [];
  for (const tag of tags(html, 'img')) {
    imageUrls.push(safeUrl(attr(tag, 'src')));
    const srcset = attr(tag, 'srcset');
    if (srcset) {
      srcset.split(',').forEach((candidate) => imageUrls.push(safeUrl(candidate.trim().split(/\s+/)[0])));
    }
  }
  return { css, js, images: uniq(imageUrls) };
}

function safeUrl(value) {
  if (!value) return '';
  try {
    return new URL(value, BASE_URL).href;
  } catch {
    return '';
  }
}

function wordCount(html) {
  const words = textOnly(html).replace(/[^\p{L}\p{N}\s'-]/gu, ' ').trim();
  return words ? words.split(/\s+/).length : 0;
}

function keywordCoverage(text) {
  const lower = text.toLowerCase();
  return keywords.map((keyword) => {
    const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { keyword, present: lower.includes(keyword.toLowerCase()), count: (lower.match(new RegExp(escaped, 'g')) ?? []).length };
  });
}

function classifyLinks(pageLinks) {
  const by = {
    phone: pageLinks.filter((link) => /^tel:/i.test(link.href)),
    email: pageLinks.filter((link) => /^mailto:/i.test(link.href)),
    whatsapp: pageLinks.filter((link) => /(^https?:\/\/)?([^/]+\.)?(wa\.me|api\.whatsapp\.com|whatsapp\.com)\b/i.test(link.href)),
    telegram: pageLinks.filter((link) => /(^https?:\/\/)?([^/]+\.)?(t\.me|telegram\.me)\b/i.test(link.href)),
    contact: pageLinks.filter((link) => internalNeedle(link.href, ['contact'])),
    submitApplication: pageLinks.filter((link) => internalNeedle(link.href, ['submit', 'application'])),
  };
  by.keyInternal = pageLinks.filter((link) => internalNeedle(link.href, leadNeedles)).slice(0, 60);
  by.suspiciousExternal = pageLinks.filter((link) => {
    try {
      const url = new URL(link.href, BASE_URL);
      return url.origin !== BASE_URL && badExternalPattern.test(link.href);
    } catch {
      return false;
    }
  });
  return by;
}

function internalNeedle(href, needles) {
  try {
    const url = new URL(href, BASE_URL);
    return url.origin === BASE_URL && needles.some((needle) => `${url.pathname}${url.search}`.toLowerCase().includes(needle));
  } catch {
    return false;
  }
}

function contactValues(groups) {
  return {
    phones: uniq(groups.phone.map((link) => link.href.replace(/^tel:/i, '').replace(/[^\d+]/g, ''))),
    emails: uniq(groups.email.map((link) => link.href.replace(/^mailto:/i, '').split('?')[0].toLowerCase())),
    whatsapps: uniq(groups.whatsapp.map((link) => {
      try {
        const url = new URL(link.href, BASE_URL);
        if (url.hostname === 'wa.me') return url.pathname.replace(/[^\d]/g, '');
        return (url.searchParams.get('phone') ?? '').replace(/[^\d]/g, '');
      } catch {
        return '';
      }
    })),
  };
}

function pluginMatches(html, pageAssets) {
  const haystack = [html, ...pageAssets.css, ...pageAssets.js.map((item) => item.src)].join('\n');
  return pluginRules.map(([key, name, pattern]) => ({
    key,
    name,
    detected: pattern.test(haystack),
    assetCount: [...pageAssets.css, ...pageAssets.js.map((item) => item.src)].filter((url) => pattern.test(url)).length,
  })).filter((item) => item.detected);
}

function domains(pageAssets, pageLinks) {
  return uniq([...pageAssets.css, ...pageAssets.js.map((item) => item.src), ...pageAssets.images, ...pageLinks.map((link) => link.absolute)]
    .map((url) => {
      try {
        return new URL(url, BASE_URL).hostname.replace(/^www\./, '');
      } catch {
        return '';
      }
    })
    .filter((host) => host && host !== 'malendo-property.com')).sort();
}

async function fetchText(pathOrUrl, method = 'GET') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(abs(pathOrUrl), {
      method,
      redirect: 'follow',
      headers: { 'user-agent': 'MalendoTechnicalAudit/1.0', accept: method === 'HEAD' ? '*/*' : 'text/html,application/xml,text/plain,*/*;q=0.8' },
      signal: controller.signal,
    });
    const text = method === 'HEAD' ? '' : await response.text();
    return { ok: true, status: response.status, finalUrl: response.url, text, headers: response.headers };
  } catch (error) {
    return { ok: false, status: 0, finalUrl: abs(pathOrUrl), text: '', headers: new Headers(), error: error?.message ?? String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function imageHead(url) {
  if (headCache.has(url)) return headCache.get(url);
  const result = await fetchText(url, 'HEAD');
  const item = {
    url,
    status: result.status,
    bytes: Number(result.headers.get('content-length') ?? 0) || 0,
    contentType: result.headers.get('content-type') ?? '',
  };
  headCache.set(url, item);
  return item;
}

async function auditPage(path) {
  const url = abs(path);
  const response = await fetchText(url);
  const html = response.text;
  const pageLinks = links(html);
  const leadLinks = classifyLinks(pageLinks);
  const pageAssets = assets(html);
  const h1Texts = h1s(html);
  const title = titleOf(html);
  const description = meta(html, 'description');
  const robots = meta(html, 'robots');
  const canonical = canonicalOf(html);
  const words = wordCount(html);
  const text = textOnly(html);
  const coverage = keywordCoverage(text);
  const old = legacyStrings.filter((needle) => html.includes(needle));
  const earlyLead = classifyLinks(links(html.slice(0, Math.min(25000, html.length))));
  const primaryCtaAboveFold = Object.values(earlyLead).some((items) => Array.isArray(items) && items.length > 0);
  const largestImages = (await Promise.all(pageAssets.images.slice(0, IMAGE_HEAD_LIMIT).map(imageHead)))
    .filter((item) => item.bytes)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5);
  const findings = [];

  if (response.status !== 200) findings.push({ priority: 'P0', area: 'Safety', issue: `Expected HTTP 200, got ${response.status}` });
  if (!title) findings.push({ priority: 'P1', area: 'SEO', issue: 'Missing title tag' });
  else if (title.length < 30) findings.push({ priority: 'P1', area: 'SEO', issue: `Title is short (${title.length} chars)` });
  else if (title.length > 65) findings.push({ priority: 'P2', area: 'SEO', issue: `Title may be long (${title.length} chars)` });
  if (!description) findings.push({ priority: 'P1', area: 'SEO', issue: 'Missing meta description' });
  else if (description.length < 80) findings.push({ priority: 'P2', area: 'SEO', issue: `Meta description is short (${description.length} chars)` });
  else if (description.length > 170) findings.push({ priority: 'P3', area: 'SEO', issue: `Meta description may be long (${description.length} chars)` });
  if (!h1Texts.length) findings.push({ priority: 'P1', area: 'SEO', issue: 'Missing H1' });
  else if (h1Texts.length > 1) findings.push({ priority: 'P2', area: 'SEO', issue: `Multiple H1s (${h1Texts.length})` });
  if (words < 300) findings.push({ priority: 'P2', area: 'Content', issue: `Page looks thin (${words} approximate words)` });
  if (canonical && canonical.replace(/\/+$/, '') !== response.finalUrl.replace(/\/+$/, '')) findings.push({ priority: 'P1', area: 'SEO', issue: `Canonical differs from final URL: ${canonical}` });
  if (/noindex/i.test(robots)) findings.push({ priority: 'P1', area: 'SEO', issue: `Page has noindex robots meta: ${robots}` });
  old.forEach((needle) => findings.push({ priority: needle.includes('info@') ? 'P1' : 'P2', area: 'Content', issue: `Legacy string found: ${needle}` }));
  if (/(posted on|posted by|published on|categories|category:|tags:|by admin|author:|leave a comment)/i.test(text)) findings.push({ priority: 'P3', area: 'UX', issue: 'Page includes date/admin/category blog-style metadata cues' });
  const missingCoreTerms = coverage.filter((item) => !item.present && ['Phuket', 'real estate', 'property'].includes(item.keyword)).map((item) => item.keyword);
  if (missingCoreTerms.length) findings.push({ priority: 'P2', area: 'SEO', issue: `Missing useful local SEO terms: ${missingCoreTerms.join(', ')}` });

  const leadCounts = {
    phone: leadLinks.phone.length,
    email: leadLinks.email.length,
    whatsapp: leadLinks.whatsapp.length,
    telegram: leadLinks.telegram.length,
    contact: leadLinks.contact.length,
    submitApplication: leadLinks.submitApplication.length,
  };
  if (Object.values(leadCounts).every((count) => count === 0)) findings.push({ priority: 'P1', area: 'Conversion', issue: 'No clear lead/contact CTA links found' });
  else if (!primaryCtaAboveFold) findings.push({ priority: 'P2', area: 'Conversion', issue: 'No primary lead CTA detected in early HTML/approximate above-fold area' });
  if (leadLinks.suspiciousExternal.length) findings.push({ priority: 'P0', area: 'Safety', issue: `Suspicious external links found: ${leadLinks.suspiciousExternal.map((link) => link.href).join(', ')}` });
  const renderBlockingScripts = pageAssets.js.filter((item) => !item.async && !item.defer).map((item) => item.src);
  if (pageAssets.css.length > 30 || pageAssets.js.length > 40) findings.push({ priority: 'P3', area: 'Performance', issue: `Heavy asset count: ${pageAssets.css.length} CSS, ${pageAssets.js.length} JS` });
  if (renderBlockingScripts.length > 20) findings.push({ priority: 'P3', area: 'Performance', issue: `${renderBlockingScripts.length} possible render-blocking scripts` });
  if (largestImages[0]?.bytes > 500000) findings.push({ priority: 'P3', area: 'Performance', issue: `Large image detected: ${formatBytes(largestImages[0].bytes)} ${largestImages[0].url}` });

  return {
    url,
    status: response.status,
    finalUrl: response.finalUrl,
    htmlBytes: Buffer.byteLength(html, 'utf8'),
    canonical,
    robots,
    title,
    titleLength: title.length,
    metaDescription: description,
    metaDescriptionLength: description.length,
    h1Count: h1Texts.length,
    h1Texts,
    wordCount: words,
    thin: words < 300,
    blogMetadata: findings.some((finding) => finding.issue.includes('blog-style')),
    oldBrandStrings: old,
    keywordCoverage: coverage,
    schemaTypes: jsonLdTypes(html),
    leadCounts,
    primaryCtaAboveFold,
    contactValues: contactValues(leadLinks),
    cssCount: pageAssets.css.length,
    jsCount: pageAssets.js.length,
    imageCount: pageAssets.images.length,
    imageUrlCount: pageAssets.images.length,
    largestImages,
    thirdPartyDomains: domains(pageAssets, pageLinks),
    plugins: pluginMatches(html, pageAssets),
    renderBlocking: { css: pageAssets.css, scripts: renderBlockingScripts },
    keyInternalLinks: leadLinks.keyInternal,
    suspiciousExternalLinks: leadLinks.suspiciousExternal,
    linksToContact: leadLinks.contact.length > 0,
    linksToSubmitApplication: leadLinks.submitApplication.length > 0,
    linksToListings: pageLinks.some((link) => {
      try {
        return new URL(link.href, BASE_URL).pathname.includes('/properties/');
      } catch {
        return false;
      }
    }),
    findings,
  };
}

async function auditSitemap() {
  const robots = await fetchText('/robots.txt');
  const sitemap = await fetchText('/sitemap_index.xml');
  const urls = [...sitemap.text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => match[1].trim());
  const counts = { pages: 0, estates: 0, products: 0, productCategories: 0, available: 0, authorUser: 0, categories: 0, other: 0 };
  for (const item of urls) {
    const file = item.toLowerCase().split('/').pop() ?? '';
    if (/product-sitemap\d*\.xml$/.test(file)) counts.products += 1;
    else if (/estate-sitemap\d*\.xml$/.test(file)) counts.estates += 1;
    else if (/page-sitemap\d*\.xml$/.test(file)) counts.pages += 1;
    else if (/(product[_-]?cat|product-category)-sitemap\d*\.xml$/.test(file)) counts.productCategories += 1;
    else if (/available-sitemap\d*\.xml$/.test(file)) counts.available += 1;
    else if (/(author|user)-sitemap\d*\.xml$/.test(file)) counts.authorUser += 1;
    else if (/category-sitemap\d*\.xml$/.test(file)) counts.categories += 1;
    else counts.other += 1;
  }
  const findings = [];
  if (robots.status !== 200) findings.push({ priority: 'P2', area: 'SEO', issue: `robots.txt not available as HTTP 200 (${robots.status})` });
  if (sitemap.status !== 200) findings.push({ priority: 'P1', area: 'SEO', issue: `sitemap_index.xml not available as HTTP 200 (${sitemap.status})` });
  if (counts.products >= 10) findings.push({ priority: 'P1', area: 'SEO', issue: `Product sitemap count is high (${counts.products}); review WooCommerce indexation strategy` });
  if (counts.productCategories) findings.push({ priority: 'P1', area: 'SEO', issue: 'Product category sitemap is present; likely Yoast/WooCommerce cleanup item' });
  if (counts.available) findings.push({ priority: 'P2', area: 'SEO', issue: 'Available sitemap is present; review whether this is useful for indexation' });
  if (counts.authorUser) findings.push({ priority: 'P2', area: 'SEO', issue: 'Author/user sitemap is present; review noindex/sitemap settings' });
  return {
    robots: { status: robots.status, finalUrl: robots.finalUrl, text: robots.text },
    sitemap: { status: sitemap.status, finalUrl: sitemap.finalUrl, urls, counts },
    findings,
  };
}

function aggregatePlugins(pages) {
  const map = new Map();
  for (const page of pages) {
    for (const plugin of page.plugins) {
      const current = map.get(plugin.key) ?? { key: plugin.key, name: plugin.name, pages: 0, assetCount: 0, pageUrls: [] };
      current.pages += 1;
      current.assetCount += plugin.assetCount;
      current.pageUrls.push(page.url);
      map.set(plugin.key, current);
    }
  }
  return [...map.values()].sort((a, b) => b.assetCount - a.assetCount || b.pages - a.pages);
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function priorities(audit) {
  const all = [...audit.safetyFindings, ...audit.seoFindings, ...audit.conversionFindings, ...audit.performanceFindings];
  return ['P0', 'P1', 'P2', 'P3', 'P4'].reduce((acc, key) => ({ ...acc, [key]: all.filter((item) => item.priority === key) }), {});
}

function buildRecommendations(pages, sitemap) {
  const recommendedCodexTasks = [
    { priority: 'P2', task: 'Keep using read-only QA/audit scripts after WP-admin cleanup to verify lead links, canonicals, sitemap bloat, and safety regressions.' },
  ];
  const recommendedWpAdminTasks = [];
  if (pages.some((page) => page.oldBrandStrings.length)) recommendedWpAdminTasks.push({ priority: 'P1', task: 'Clean legacy brand/contact/copyright strings in WP admin, Yoast, MyHome options, footer builder, widgets, and page content.' });
  if (sitemap.sitemap.counts.products >= 10) recommendedWpAdminTasks.push({ priority: 'P1', task: 'Review WooCommerce product indexation in Google Search Console, then noindex low-value product/product-category inventory in Yoast if it is not driving qualified leads.' });
  if (pages.some((page) => !page.primaryCtaAboveFold)) recommendedWpAdminTasks.push({ priority: 'P2', task: 'Add or move phone/email/contact/submit CTAs higher on commercial landing pages where no early CTA is detected.' });
  recommendedWpAdminTasks.push({ priority: 'P3', task: 'Review plugin settings for RevSlider, WPBakery, WooCommerce, ESSB, Chaty, CookieYes, GTranslate, and Font Awesome so assets load only where business-critical.' });
  return { recommendedCodexTasks, recommendedWpAdminTasks };
}

async function buildAudit() {
  const pages = [];
  for (const path of pagesToAudit) pages.push(await auditPage(path));
  const sitemapFindings = await auditSitemap();
  const pageFindings = pages.flatMap((page) => page.findings.map((finding) => ({ ...finding, url: page.url })));
  const allFindings = [...pageFindings, ...sitemapFindings.findings.map((finding) => ({ ...finding, url: `${BASE_URL}/sitemap_index.xml` }))];
  const recommendations = buildRecommendations(pages, sitemapFindings);
  return {
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    pages,
    assets: {
      totalCss: pages.reduce((sum, page) => sum + page.cssCount, 0),
      totalJs: pages.reduce((sum, page) => sum + page.jsCount, 0),
      totalImages: pages.reduce((sum, page) => sum + page.imageCount, 0),
      thirdPartyDomains: uniq(pages.flatMap((page) => page.thirdPartyDomains)).sort(),
    },
    plugins: aggregatePlugins(pages),
    seoFindings: allFindings.filter((item) => item.area === 'SEO' || item.area === 'Content'),
    conversionFindings: allFindings.filter((item) => item.area === 'Conversion' || item.area === 'UX'),
    performanceFindings: allFindings.filter((item) => item.area === 'Performance'),
    safetyFindings: allFindings.filter((item) => item.area === 'Safety'),
    sitemapFindings,
    ...recommendations,
  };
}

function table(rows, headers) {
  return [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${headers.map((header) => escMd(row[header] ?? '')).join(' | ')} |`)].join('\n');
}

function printConsole(audit) {
  const group = priorities(audit);
  console.log(`Malendo technical audit: ${audit.baseUrl}`);
  console.log(`Generated: ${audit.generatedAt}`);
  console.log(`Pages audited: ${audit.pages.length}`);
  console.log(`Assets observed: CSS ${audit.assets.totalCss}, JS ${audit.assets.totalJs}, images ${audit.assets.totalImages}`);
  console.log('\nExecutive summary:');
  console.log(`- P0 critical safety findings: ${group.P0.length}`);
  console.log(`- P1 SEO/indexation findings: ${group.P1.length}`);
  console.log(`- P2 conversion/content findings: ${group.P2.length}`);
  console.log(`- P3 performance/cleanup findings: ${group.P3.length}`);
  console.log(`- Product sitemap entries: ${audit.sitemapFindings.sitemap.counts.products}`);
  console.log('\nTop findings:');
  [...group.P0, ...group.P1, ...group.P2].slice(0, 20).forEach((finding) => console.log(`- [${finding.priority}] ${finding.area}: ${finding.issue} (${finding.url})`));
  console.log('\nPer-page summary:');
  audit.pages.forEach((page) => console.log(`- ${page.url}: HTTP ${page.status}, H1 ${page.h1Count}, words ${page.wordCount}, CSS ${page.cssCount}, JS ${page.jsCount}, images ${page.imageCount}, findings ${page.findings.length}`));
  console.log('\nPlugin/asset fingerprints:');
  audit.plugins.forEach((plugin) => console.log(`- ${plugin.name}: ${plugin.pages} page(s), ${plugin.assetCount} matching asset(s)`));
  console.log('\nRecommended Codex/Git tasks:');
  audit.recommendedCodexTasks.forEach((task) => console.log(`- [${task.priority}] ${task.task}`));
  console.log('\nRecommended WP-admin tasks:');
  audit.recommendedWpAdminTasks.forEach((task) => console.log(`- [${task.priority}] ${task.task}`));
}

function printMarkdown(audit) {
  const group = priorities(audit);
  const thin = audit.pages.filter((page) => page.thin);
  const ctaIssues = audit.pages.filter((page) => !page.primaryCtaAboveFold || Object.values(page.leadCounts).every((count) => count === 0));
  const lines = [
    '# Malendo Technical SEO, Performance, and Conversion Audit',
    '',
    `Generated: ${audit.generatedAt}`,
    '',
    '## Executive Summary',
    '',
    `- Pages audited: ${audit.pages.length}`,
    `- P0 critical safety findings: ${group.P0.length}`,
    `- P1 SEO/indexation findings: ${group.P1.length}`,
    `- P2 conversion/content findings: ${group.P2.length}`,
    `- P3 performance/asset findings: ${group.P3.length}`,
    `- Sitemap product entries: ${audit.sitemapFindings.sitemap.counts.products}`,
    `- Total observed assets: ${audit.assets.totalCss} CSS, ${audit.assets.totalJs} JS, ${audit.assets.totalImages} image URLs`,
    '',
    '## Priority Matrix',
    '',
  ];
  for (const [priority, label] of [['P0', 'critical safety'], ['P1', 'SEO/indexation'], ['P2', 'conversion/lead'], ['P3', 'performance/assets'], ['P4', 'content improvements']]) {
    lines.push(`### ${priority} ${label}`, '');
    lines.push(group[priority].length ? group[priority].slice(0, 30).map((finding) => `- **${escMd(finding.area)}**: ${escMd(finding.issue)} (${escMd(finding.url)})`).join('\n') : '- None', '');
  }
  lines.push(
    '## Per-Page Findings',
    '',
    table(audit.pages.map((page) => ({
      URL: page.url,
      Status: page.status,
      Title: trunc(page.title, 55),
      H1: page.h1Count,
      Words: page.wordCount,
      Canonical: page.canonical ? trunc(page.canonical, 55) : 'missing',
      CTAs: Object.values(page.leadCounts).reduce((sum, count) => sum + count, 0),
      Assets: `${page.cssCount} CSS / ${page.jsCount} JS / ${page.imageCount} img`,
      Findings: page.findings.length,
    })), ['URL', 'Status', 'Title', 'H1', 'Words', 'Canonical', 'CTAs', 'Assets', 'Findings']),
    '',
    '## Plugin/Asset Bloat',
    '',
    table(audit.plugins.map((plugin) => ({ Plugin: plugin.name, Pages: plugin.pages, Assets: plugin.assetCount, Notes: 'Review settings before code dequeues' })), ['Plugin', 'Pages', 'Assets', 'Notes']),
    '',
    '## Thin-Content Landing Pages',
    '',
    thin.length ? thin.map((page) => `- ${escMd(page.url)}: ${page.wordCount} approximate words`).join('\n') : '- None',
    '',
    '## Contact/CTA Issues',
    '',
    ctaIssues.length ? ctaIssues.map((page) => `- ${escMd(page.url)}: ${page.primaryCtaAboveFold ? 'CTA exists but review quality' : 'No early CTA detected'}`).join('\n') : '- None',
    '',
    '## Sitemap/Indexation Issues',
    '',
    `- robots.txt HTTP status: ${audit.sitemapFindings.robots.status}`,
    `- sitemap_index.xml HTTP status: ${audit.sitemapFindings.sitemap.status}`,
    `- sitemap counts: pages=${audit.sitemapFindings.sitemap.counts.pages}, estates=${audit.sitemapFindings.sitemap.counts.estates}, products=${audit.sitemapFindings.sitemap.counts.products}, productCategories=${audit.sitemapFindings.sitemap.counts.productCategories}, available=${audit.sitemapFindings.sitemap.counts.available}, authorUser=${audit.sitemapFindings.sitemap.counts.authorUser}`,
    audit.sitemapFindings.findings.length ? audit.sitemapFindings.findings.map((finding) => `- [${finding.priority}] ${escMd(finding.issue)}`).join('\n') : '- No sitemap warnings found',
    '',
    '## Recommended Codex/Git Tasks',
    '',
    audit.recommendedCodexTasks.map((task) => `- [${task.priority}] ${escMd(task.task)}`).join('\n'),
    '',
    '## Recommended WP-admin Tasks',
    '',
    audit.recommendedWpAdminTasks.map((task) => `- [${task.priority}] ${escMd(task.task)}`).join('\n'),
    '',
    '## Do-Not-Do Safety Notes',
    '',
    '- Do not edit WordPress core.',
    '- Do not edit the MyHome parent theme.',
    '- Do not bulk replace WPBakery/MyHome serialized content.',
    '- Do not noindex WooCommerce products before checking Google Search Console if product traffic matters.',
    '- Do not add schema until official brand/email/phone/address/socials are confirmed.',
    '- Do not remove the temporary Submit URL safety patch until the real WP/MyHome/menu source is fixed and verified.',
  );
  console.log(lines.join('\n'));
}

async function main() {
  const audit = await buildAudit();
  if (mode === 'json') console.log(JSON.stringify(audit, null, 2));
  else if (mode === 'markdown') printMarkdown(audit);
  else printConsole(audit);
}

main().catch((error) => {
  if (mode === 'json') console.log(JSON.stringify({ baseUrl: BASE_URL, generatedAt: new Date().toISOString(), error: error?.stack ?? String(error) }, null, 2));
  else {
    console.error('Audit runtime failed.');
    console.error(error?.stack ?? String(error));
  }
  process.exitCode = 1;
});
