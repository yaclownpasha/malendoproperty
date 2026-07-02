#!/usr/bin/env node

const BASE_URL = 'https://malendo-property.com';
const TIMEOUT_MS = 25000;

const pages = [
  '/',
  '/contact/',
  '/submit-your-application/',
  '/properties/',
  '/rent-property/rent-villas/',
  '/rent-property/rent-apartment/',
  '/sell-property/sell-apartment/',
  '/thailand/phuket/services/property-management/',
];

const ownerRules = [
  ['MyHome theme', /\/themes\/myhome\/|myhome/i, 'unsafe', 'no action', 'Required theme behavior; do not dequeue globally.'],
  ['Malendo child theme', /\/themes\/malendo-child\/|malendo-lead-events|malendo-child-style/i, 'unsafe', 'no action', 'Child-theme owned style/tracking; keep unless replacing with equivalent behavior.'],
  ['WPBakery / Visual Composer', /\/plugins\/js_composer\/|wpbakery|\bvc_/i, 'unsafe', 'WP-admin/plugin setting', 'Likely required where page-builder content renders; do not dequeue globally.'],
  ['WooCommerce', /\/plugins\/woocommerce\/|wc-|woocommerce|add-to-cart/i, 'risky', 'later child-theme conditional dequeue', 'Only consider after product/indexation and product-page QA decisions.'],
  ['Contact Form 7', /\/plugins\/contact-form-7\/|wpcf7|wpcf7-redirect|intl-tel-input/i, 'risky', 'later child-theme conditional dequeue', 'Only consider on pages proven to have no forms, no recaptcha, and no phone input.'],
  ['RevSlider', /\/plugins\/revslider\/|sr7|revolution/i, 'risky', 'WP-admin/plugin setting', 'Prefer disabling global loading in plugin settings if sliders are unused.'],
  ['Easy Social Share Buttons', /easy-social-share-buttons|essb/i, 'likely safe', 'WP-admin/plugin setting', 'Disable unused modules in plugin settings before code.'],
  ['Chaty', /\/plugins\/chaty\/|chaty/i, 'risky', 'WP-admin/plugin setting', 'Lead channel; only delay/target if owner confirms.'],
  ['Cookie / consent', /cookieyes|complianz|cookie-law-info|cookiedatabase/i, 'risky', 'WP-admin/plugin setting', 'Consent/legal tooling; fix settings, do not remove blindly.'],
  ['GTranslate', /gtranslate|cdn\.gtranslate\.net/i, 'risky', 'WP-admin/plugin setting', 'Keep if multilingual traffic converts; otherwise review settings.'],
  ['Font Awesome / icon libraries', /font-?awesome|fontawesome|\/fa-/i, 'risky', 'WP-admin/plugin setting', 'Icons may support menus/social widgets; inventory before changes.'],
  ['Google Analytics / gtag', /googletagmanager|gtag|G-D99Y7TY0LC/i, 'unsafe', 'no action', 'Measurement-critical; do not remove without owner approval.'],
  ['Yandex analytics', /yandex|mc\.yandex\.ru/i, 'risky', 'WP-admin/plugin setting', 'Confirm whether still needed.'],
  ['WordPress core', /\/wp-includes\//i, 'unsafe', 'no action', 'Core dependencies; do not dequeue without exact dependency analysis.'],
  ['Other plugin/theme asset', /\/wp-content\/plugins\/|\/wp-content\/themes\//i, 'risky', 'manual review', 'Identify owner before changing.'],
  ['Third-party CDN/service', /^https?:\/\/(?!malendo-property\.com)/i, 'risky', 'manual review', 'Confirm business purpose before changing.'],
];

const mode = process.argv.includes('--json') ? 'json' : process.argv.includes('--markdown') ? 'markdown' : 'console';

function abs(path) {
  return path.startsWith('http') ? path : `${BASE_URL}${path}`;
}

function decode(value) {
  return String(value ?? '')
    .replace(/&amp;/gi, '&')
    .replace(/&#038;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'");
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(['"])(.*?)\\1`, 'i'));
  return match ? decode(match[2].trim()) : '';
}

function safeUrl(value) {
  if (!value) return '';
  try {
    return new URL(decode(value), BASE_URL).href;
  } catch {
    return '';
  }
}

function stripVersion(url) {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.href;
  } catch {
    return url;
  }
}

function inferHandle(id) {
  if (!id) return '';
  return id
    .replace(/-(css|js|js-extra)$/i, '')
    .replace(/-inline-css$/i, '')
    .replace(/-inline-js$/i, '')
    .replace(/-css-css$/i, '')
    .replace(/-js-js$/i, '') || id;
}

function classify(url, id = '') {
  const haystack = `${url} ${id}`;
  for (const [owner, pattern, risk, action, note] of ownerRules) {
    if (pattern.test(haystack)) return { owner, risk, action, note };
  }
  return { owner: 'Unknown', risk: 'risky', action: 'manual review', note: 'Owner and handle are not obvious from live HTML.' };
}

function extractAssets(html, pageUrl) {
  const assets = [];
  for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
    const raw = tag[0];
    const rel = attr(raw, 'rel');
    const href = safeUrl(attr(raw, 'href'));
    if (!href || !/stylesheet/i.test(rel)) continue;
    const id = attr(raw, 'id');
    const info = classify(href, id);
    assets.push({
      type: 'css',
      url: href,
      normalizedUrl: stripVersion(href),
      id,
      likelyHandle: inferHandle(id),
      pageUrl,
      ...info,
    });
  }
  for (const tag of html.matchAll(/<script\b[^>]*>/gi)) {
    const raw = tag[0];
    const src = safeUrl(attr(raw, 'src'));
    if (!src) continue;
    const id = attr(raw, 'id');
    const info = classify(src, id);
    assets.push({
      type: 'js',
      url: src,
      normalizedUrl: stripVersion(src),
      id,
      likelyHandle: inferHandle(id),
      pageUrl,
      async: /\basync\b/i.test(raw),
      defer: /\bdefer\b/i.test(raw),
      ...info,
    });
  }
  return assets;
}

async function fetchPage(pagePath) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(abs(pagePath), {
      redirect: 'follow',
      headers: { 'user-agent': 'MalendoAssetDiscovery/1.0', accept: 'text/html,*/*;q=0.8' },
      signal: controller.signal,
    });
    return { pagePath, url: abs(pagePath), finalUrl: response.url, status: response.status, html: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

function summarize(pageResults) {
  const byAsset = new Map();
  for (const page of pageResults) {
    for (const asset of page.assets) {
      const key = `${asset.type}|${asset.normalizedUrl}`;
      if (!byAsset.has(key)) {
        byAsset.set(key, { ...asset, pages: [], pageCount: 0, appearsGlobally: false, examples: new Set() });
      }
      const entry = byAsset.get(key);
      if (!entry.pages.includes(page.pagePath)) {
        entry.pages.push(page.pagePath);
        entry.pageCount += 1;
      }
      entry.examples.add(asset.url);
      if (!entry.id && asset.id) entry.id = asset.id;
      if (!entry.likelyHandle && asset.likelyHandle) entry.likelyHandle = asset.likelyHandle;
    }
  }

  const assets = [...byAsset.values()].map((asset) => ({
    ...asset,
    appearsGlobally: asset.pageCount === pages.length,
    examples: [...asset.examples].slice(0, 3),
  })).sort((a, b) => b.pageCount - a.pageCount || a.owner.localeCompare(b.owner) || a.type.localeCompare(b.type));

  const ownerMap = new Map();
  for (const asset of assets) {
    const current = ownerMap.get(asset.owner) ?? { owner: asset.owner, css: 0, js: 0, globalAssets: 0, risk: asset.risk, action: asset.action, note: asset.note };
    current[asset.type] += 1;
    if (asset.appearsGlobally) current.globalAssets += 1;
    ownerMap.set(asset.owner, current);
  }

  return {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    pages: pageResults.map((page) => ({
      path: page.pagePath,
      url: page.finalUrl,
      status: page.status,
      cssCount: page.assets.filter((asset) => asset.type === 'css').length,
      jsCount: page.assets.filter((asset) => asset.type === 'js').length,
    })),
    assets,
    owners: [...ownerMap.values()].sort((a, b) => (b.css + b.js) - (a.css + a.js)),
    childThemeHandles: [
      { handle: 'malendo-child-style', source: 'wp-content/themes/malendo-child/functions.php', asset: 'style.css' },
      { handle: 'malendo-lead-events', source: 'wp-content/themes/malendo-child/functions.php', asset: 'assets/js/lead-events.js' },
      { handle: 'Google tag G-D99Y7TY0LC', source: 'wp-content/themes/malendo-child/functions.php wp_head hook', asset: 'googletagmanager.com/gtag/js' },
    ],
  };
}

function md(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function table(rows, headers) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${headers.map((header) => md(row[header])).join(' | ')} |`),
  ].join('\n');
}

function printConsole(report) {
  console.log(`Malendo asset discovery: ${report.generatedAt}`);
  console.log(`Pages checked: ${report.pages.length}`);
  console.log('');
  console.log('Page counts:');
  report.pages.forEach((page) => console.log(`- ${page.path}: HTTP ${page.status}, ${page.cssCount} CSS, ${page.jsCount} JS`));
  console.log('');
  console.log('Owner summary:');
  report.owners.forEach((owner) => console.log(`- ${owner.owner}: ${owner.css} CSS, ${owner.js} JS, ${owner.globalAssets} global asset(s), risk=${owner.risk}, action=${owner.action}`));
  console.log('');
  console.log('Global assets:');
  report.assets.filter((asset) => asset.appearsGlobally).forEach((asset) => {
    console.log(`- ${asset.type.toUpperCase()} ${asset.normalizedUrl} | owner=${asset.owner} | handle=${asset.likelyHandle || 'uncertain'} | risk=${asset.risk}`);
  });
}

function printMarkdown(report) {
  const lines = [
    '# Malendo Asset Handle Discovery',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Page Asset Counts',
    '',
    table(report.pages.map((page) => ({
      Page: page.path,
      Status: page.status,
      CSS: page.cssCount,
      JS: page.jsCount,
    })), ['Page', 'Status', 'CSS', 'JS']),
    '',
    '## Child Theme Handles Found In Code',
    '',
    table(report.childThemeHandles.map((item) => ({
      Handle: item.handle,
      Source: item.source,
      Asset: item.asset,
    })), ['Handle', 'Source', 'Asset']),
    '',
    '## Owner / Plugin Summary',
    '',
    table(report.owners.map((owner) => ({
      Owner: owner.owner,
      CSS: owner.css,
      JS: owner.js,
      Global: owner.globalAssets,
      Risk: owner.risk,
      Action: owner.action,
      Note: owner.note,
    })), ['Owner', 'CSS', 'JS', 'Global', 'Risk', 'Action', 'Note']),
    '',
    '## Asset Details',
    '',
    table(report.assets.map((asset) => ({
      Type: asset.type,
      Owner: asset.owner,
      Handle: asset.likelyHandle || 'uncertain',
      ID: asset.id || '',
      Global: asset.appearsGlobally ? 'yes' : 'no',
      Pages: asset.pages.join(', '),
      Risk: asset.risk,
      Action: asset.action,
      URL: asset.normalizedUrl,
    })), ['Type', 'Owner', 'Handle', 'ID', 'Global', 'Pages', 'Risk', 'Action', 'URL']),
    '',
    '## Validation Guidance',
    '',
    '- Run live QA before and after any future dequeue.',
    '- Compare this report before and after changes.',
    '- Check homepage, contact, submit, properties archive, rent/sell landing pages, estate pages, product pages, and product category pages.',
    '- Confirm lead-events, GA4, forms, menus, MyHome listing cards, search/filter UI, Chaty, GTranslate, and console behavior still work.',
  ];
  console.log(lines.join('\n'));
}

async function main() {
  const pageResults = [];
  for (const page of pages) {
    const result = await fetchPage(page);
    pageResults.push({ ...result, assets: extractAssets(result.html, result.finalUrl) });
  }
  const report = summarize(pageResults);
  if (mode === 'json') console.log(JSON.stringify(report, null, 2));
  else if (mode === 'markdown') printMarkdown(report);
  else printConsole(report);
}

main().catch((error) => {
  if (mode === 'json') console.log(JSON.stringify({ error: error?.message ?? String(error) }, null, 2));
  else console.error(`Asset discovery failed: ${error?.message ?? String(error)}`);
  process.exitCode = 1;
});
