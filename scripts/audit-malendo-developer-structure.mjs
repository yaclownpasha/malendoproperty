#!/usr/bin/env node

const BASE_URL = 'https://malendo-property.com';
const TIMEOUT_MS = 30000;
const args = process.argv.slice(2);
const mode = args.includes('--json') ? 'json' : args.includes('--markdown') ? 'markdown' : 'console';

function decode(value) {
  return String(value ?? '')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
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

function firstMatch(value, expression) {
  const match = value.match(expression);
  return match ? textOnly(match[1]) : '';
}

function canonicalOf(html) {
  const tag = tags(html, 'link').find((item) => /\brel\s*=\s*['"][^'"]*canonical/i.test(item));
  return tag ? attr(tag, 'href') : '';
}

function metaRobotsOf(html) {
  const tag = tags(html, 'meta').find((item) => attr(item, 'name').toLowerCase() === 'robots');
  return tag ? attr(tag, 'content') : '';
}

function linksOf(html) {
  const links = [];
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(['"])(.*?)\1[\s\S]*?<\/a>/gi)) {
    const href = decode(match[2]);
    let absolute = '';
    try {
      absolute = new URL(href, BASE_URL).href;
    } catch {
      absolute = href;
    }
    links.push({ href: absolute, text: textOnly(match[0]).slice(0, 120) });
  }
  return links.filter((item, index, all) => all.findIndex((candidate) => candidate.href === item.href && candidate.text === item.text) === index);
}

function jsonLdTypesOf(html) {
  const types = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const type = value['@type'];
    if (Array.isArray(type)) type.forEach((item) => types.add(String(item)));
    else if (type) types.add(String(type));
    Object.values(value).forEach(visit);
  };
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(match[1].trim()));
    } catch {
      // Advisory audit: malformed JSON-LD is reported indirectly by the missing type list.
    }
  }
  return [...types].sort();
}

async function fetchText(pathOrUrl) {
  const url = new URL(pathOrUrl, BASE_URL);
  url.searchParams.set('malendo_architecture_audit', Date.now().toString());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/json,application/xml,text/xml,text/plain',
        'user-agent': 'MalendoDeveloperArchitectureAudit/1.0',
      },
    });
    const body = await response.text();
    return {
      requestedUrl: url.href,
      finalUrl: response.url,
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      body,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function inspectPage(path, response) {
  const html = response.body;
  const links = linksOf(html);
  const developerProjectLinks = links.filter((link) => /developer|project/i.test(`${link.href} ${link.text}`));
  const bodyClass = firstMatch(html, /<body\b[^>]*class\s*=\s*['"]([^'"]+)/i);
  return {
    path,
    status: response.status,
    finalUrl: response.finalUrl,
    title: firstMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i),
    canonical: canonicalOf(html),
    robots: metaRobotsOf(html),
    h1: [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => textOnly(match[1])).filter(Boolean),
    bodyClass,
    pageId: (bodyClass.match(/\bpage-id-(\d+)\b/) ?? [])[1] ?? '',
    tableCount: tags(html, 'table').length,
    rowCount: tags(html, 'tr').length,
    wpBakeryMarkers: /\bvc_row\b|\bwpb_/i.test(html),
    myHomeMarkers: /\bmyhome\b|\bmh-/i.test(html),
    developerProjectLinks,
    hasSourceLabel: /\bsource\b|\bsources\b/i.test(textOnly(html)),
    hasUpdatedLabel: /last updated|updated on|data updated/i.test(textOnly(html)),
    htmlBytes: Buffer.byteLength(html),
  };
}

function inspectContentRecord(url, response) {
  const html = response.body;
  const visibleText = textOnly(html);
  const bodyClass = firstMatch(html, /<body\b[^>]*class\s*=\s*['"]([^'"]+)/i);
  const words = visibleText ? visibleText.split(/\s+/).length : 0;
  const contactLinks = linksOf(html).filter((link) => /^(tel:|mailto:)/i.test(link.href) || /\/contact\/|submit-your-application/i.test(link.href));
  const oldDomainLinks = linksOf(html).filter((link) => {
    try {
      return new URL(link.href).hostname.toLowerCase() === 'malendo.property';
    } catch {
      return false;
    }
  });
  const legacyStrings = [
    'info@malendo.property',
    'mailto:info@malendo.property',
    'https://malendo.property',
    'http://malendo.property',
    'Malendo.property',
    '2025 by Malendo',
    '2024 by Malendo',
  ];
  return {
    url,
    status: response.status,
    finalUrl: response.finalUrl,
    title: firstMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i),
    canonical: canonicalOf(html),
    robots: metaRobotsOf(html),
    h1: [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => textOnly(match[1])).filter(Boolean),
    bodyClass,
    pageId: (bodyClass.match(/\bpage-id-(\d+)\b/) ?? [])[1] ?? '',
    postId: (bodyClass.match(/\bpostid-(\d+)\b/) ?? [])[1] ?? '',
    pageType: /\bsingle-post\b/.test(bodyClass) ? 'post' : /\bpage\b/.test(bodyClass) ? 'page' : /\barchive\b/.test(bodyClass) ? 'archive' : 'unknown',
    wordCount: words,
    hasSourceLabel: /\bsource(?:s)?\s*[:\-]/i.test(visibleText),
    hasUpdatedLabel: /last updated|updated on|data updated/i.test(visibleText),
    hasVisibleDate: /\b(?:20\d{2})[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},\s+20\d{2}\b/i.test(visibleText),
    hasBlogMetadata: /\bposted by\b|\bby admin\b|\brecent posts\b|\bposted in\b/i.test(visibleText) || /\bentry-meta\b|\bpost-author\b|\bpost-date\b/i.test(html),
    hasWpBakery: /\[vc_|\bvc_row\b|\bwpb_/i.test(html),
    hasMyHome: /\bmyhome\b|\bmh-/i.test(html),
    contactLinkCount: contactLinks.length,
    legacyMatches: legacyStrings.filter((value) => html.includes(value)),
    oldDomainLinks,
    jsonLdTypes: jsonLdTypesOf(html),
  };
}

async function mapWithConcurrency(items, limit, worker) {
  const output = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      output[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return output;
}

function normalizeRestPage(item) {
  const raw = item?.content?.raw ?? '';
  const rendered = item?.content?.rendered ?? '';
  return {
    id: item?.id ?? null,
    slug: item?.slug ?? '',
    status: item?.status ?? '',
    link: item?.link ?? '',
    title: item?.title?.rendered ?? item?.title?.raw ?? '',
    template: item?.template ?? '',
    parent: item?.parent ?? null,
    modified: item?.modified ?? '',
    contentBytes: Buffer.byteLength(raw || rendered),
    hasTable: /<table\b|\[table|tablepress/i.test(raw || rendered),
    hasWpBakery: /\[vc_|\bvc_row\b|\bwpb_/i.test(raw || rendered),
    hasDeveloperProjectText: /developer|project/i.test(textOnly(raw || rendered)),
  };
}

function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => decode(match[1]).trim());
}

async function main() {
  const pagePaths = ['/developers/', '/projects/'];
  const pageResponses = await Promise.all(pagePaths.map((path) => fetchText(path)));
  const pages = pageResponses.map((response, index) => inspectPage(pagePaths[index], response));

  const [restIndexResponse, typesResponse, taxonomiesResponse, developersRestResponse, projectsRestResponse, projectChildrenResponse, developerTermsResponse, sitemapIndexResponse] = await Promise.all([
    fetchText('/wp-json/'),
    fetchText('/wp-json/wp/v2/types'),
    fetchText('/wp-json/wp/v2/taxonomies'),
    fetchText('/wp-json/wp/v2/pages?slug=developers'),
    fetchText('/wp-json/wp/v2/pages?slug=projects'),
    fetchText('/wp-json/wp/v2/pages?parent=3801&per_page=100'),
    fetchText('/wp-json/wp/v2/developer?per_page=100'),
    fetchText('/sitemap_index.xml'),
  ]);

  const safeJson = (response, fallback) => {
    try {
      return JSON.parse(response.body);
    } catch {
      return fallback;
    }
  };

  const restIndex = safeJson(restIndexResponse, {});
  const types = safeJson(typesResponse, {});
  const taxonomies = safeJson(taxonomiesResponse, {});
  let developerPages = safeJson(developersRestResponse, []);
  let projectPages = safeJson(projectsRestResponse, []);
  const projectChildren = safeJson(projectChildrenResponse, []);
  const developerTerms = safeJson(developerTermsResponse, []);

  if (!Array.isArray(developerPages)) developerPages = [];
  if (!Array.isArray(projectPages)) projectPages = [];

  const sitemapDocuments = [];
  const sitemapIndexUrls = sitemapUrls(sitemapIndexResponse.body)
    .filter((url) => /\/(?:page|post|estate|category|developer)-sitemap\.xml/i.test(url));
  for (const sitemapUrl of sitemapIndexUrls) {
    const response = await fetchText(sitemapUrl);
    const urls = sitemapUrls(response.body);
    sitemapDocuments.push({
      sitemapUrl,
      status: response.status,
      urlCount: urls.length,
      relevantUrls: urls.filter((url) => /developer|project/i.test(url)),
    });
  }

  const publicTypes = Object.entries(types).map(([key, value]) => ({
    key,
    name: value?.name ?? '',
    restBase: value?.rest_base ?? '',
    hierarchical: Boolean(value?.hierarchical),
  })).filter((item) => /estate|developer|project|property/i.test(`${item.key} ${item.name} ${item.restBase}`));

  const publicTaxonomies = Object.entries(taxonomies).map(([key, value]) => ({
    key,
    name: value?.name ?? '',
    restBase: value?.rest_base ?? '',
    types: value?.types ?? [],
    hierarchical: Boolean(value?.hierarchical),
  })).filter((item) => /estate|developer|project|property/i.test(`${item.key} ${item.name} ${item.restBase} ${(item.types ?? []).join(' ')}`));

  const relevantRoutes = Object.keys(restIndex?.routes ?? {}).filter((route) => /estate|developer|project|property|myhome/i.test(route));
  const relevantSitemaps = sitemapDocuments.filter((item) => item.relevantUrls.length > 0 || /estate|developer|project|page-sitemap/i.test(item.sitemapUrl));
  const relevantContentUrls = [...new Set([
    ...relevantSitemaps.flatMap((item) => item.relevantUrls),
    ...(Array.isArray(developerTerms) ? developerTerms.map((term) => term?.link).filter(Boolean) : []),
  ])];
  const contentRecords = await mapWithConcurrency(relevantContentUrls, 5, async (url) => inspectContentRecord(url, await fetchText(url)));

  const result = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    pages,
    wordpress: {
      developersPage: developerPages.map(normalizeRestPage),
      projectsPage: projectPages.map(normalizeRestPage),
      projectChildren: Array.isArray(projectChildren) ? projectChildren.map(normalizeRestPage) : [],
      developerTerms: Array.isArray(developerTerms) ? developerTerms.map((term) => ({
        id: term?.id ?? null,
        name: term?.name ?? '',
        slug: term?.slug ?? '',
        count: term?.count ?? 0,
        link: term?.link ?? '',
      })) : [],
      relevantRestRoutes: relevantRoutes,
      relevantPostTypes: publicTypes,
      relevantTaxonomies: publicTaxonomies,
    },
    sitemaps: relevantSitemaps,
    contentRecords,
  };

  if (mode === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (mode === 'markdown') {
    console.log('# Malendo Developer / Project Structure Audit\n');
    console.log(`Generated: ${result.generatedAt}\n`);
    console.log('| Path | HTTP | Page ID | Tables / rows | WPBakery | MyHome | Canonical |');
    console.log('|---|---:|---:|---:|---|---|---|');
    for (const page of pages) {
      console.log(`| ${page.path} | ${page.status} | ${page.pageId || '-'} | ${page.tableCount} / ${page.rowCount} | ${page.wpBakeryMarkers ? 'yes' : 'no'} | ${page.myHomeMarkers ? 'yes' : 'no'} | ${page.canonical || '-'} |`);
    }
    console.log('\n## WordPress objects\n');
    console.log('```json');
    console.log(JSON.stringify(result.wordpress, null, 2));
    console.log('```');
    console.log('\n## Relevant sitemap URLs\n');
    for (const sitemap of relevantSitemaps) {
      console.log(`- ${sitemap.sitemapUrl}: ${sitemap.urlCount} URLs; relevant: ${sitemap.relevantUrls.length}`);
      sitemap.relevantUrls.forEach((url) => console.log(`  - ${url}`));
    }
    console.log('\n## Existing developer and project records\n');
    console.log('| URL | Type | HTTP | Words | Source | Updated | Blog metadata | Old-domain links | Schema | Contact links |');
    console.log('|---|---|---:|---:|---|---|---|---:|---|---:|');
    for (const record of contentRecords) {
      console.log(`| ${record.url} | ${record.pageType} | ${record.status} | ${record.wordCount} | ${record.hasSourceLabel ? 'yes' : 'no'} | ${record.hasUpdatedLabel ? 'yes' : 'no'} | ${record.hasBlogMetadata ? 'yes' : 'no'} | ${record.oldDomainLinks.length} | ${record.jsonLdTypes.join(', ') || '-'} | ${record.contactLinkCount} |`);
    }
    console.log('\n## Exact old-domain links\n');
    const recordsWithOldLinks = contentRecords.filter((record) => record.oldDomainLinks.length > 0);
    if (recordsWithOldLinks.length === 0) console.log('None detected.');
    for (const record of recordsWithOldLinks) {
      console.log(`- ${record.url}`);
      record.oldDomainLinks.forEach((link) => console.log(`  - ${link.text || '(no anchor text)'}: ${link.href}`));
    }
    return;
  }

  console.log('Malendo Developer / Project Structure Audit');
  console.log(`Generated: ${result.generatedAt}`);
  for (const page of pages) {
    console.log(`${page.path}: HTTP ${page.status}; page ${page.pageId || 'unknown'}; ${page.tableCount} tables / ${page.rowCount} rows; canonical ${page.canonical || 'missing'}`);
  }
  console.log(`Relevant REST routes: ${relevantRoutes.length}`);
  console.log(`Relevant post types: ${publicTypes.map((item) => item.key).join(', ') || 'none detected'}`);
  console.log(`Relevant taxonomies: ${publicTaxonomies.map((item) => item.key).join(', ') || 'none detected'}`);
  console.log(`Relevant sitemap documents: ${relevantSitemaps.length}`);
  console.log(`Existing developer/project records inspected: ${contentRecords.length}`);
}

main().catch((error) => {
  console.error(`Audit failed: ${error.message}`);
  process.exitCode = 1;
});

