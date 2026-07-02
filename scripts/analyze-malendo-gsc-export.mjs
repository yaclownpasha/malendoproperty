#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_THRESHOLDS = {
  meaningfulClicks: 3,
  meaningfulImpressions: 100,
  lowCtr: 1,
  poorPosition: 20,
};

const COMMERCIAL_TYPES = new Set([
  'homepage',
  'property listing / estate',
  'rent landing page',
  'sell landing page',
  'property management page',
  'contact page',
  'submit application page',
  'properties hub',
]);

const INDEX_BLOAT_TYPES = new Set([
  'WooCommerce product page',
  'product category page',
  'available archive/page',
  'author/user page',
  'demo/test page',
]);

const args = parseArgs(process.argv.slice(2));
const thresholds = {
  meaningfulClicks: numberArg(args, 'meaningful-clicks', DEFAULT_THRESHOLDS.meaningfulClicks),
  meaningfulImpressions: numberArg(args, 'meaningful-impressions', DEFAULT_THRESHOLDS.meaningfulImpressions),
  lowCtr: numberArg(args, 'low-ctr', DEFAULT_THRESHOLDS.lowCtr),
  poorPosition: numberArg(args, 'poor-position', DEFAULT_THRESHOLDS.poorPosition),
};
const outputMode = args.flags.has('json') ? 'json' : args.flags.has('markdown') ? 'markdown' : 'console';

function parseArgs(argv) {
  const parsed = { values: new Map(), flags: new Set() };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) {
      continue;
    }
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      parsed.flags.add(key);
    } else {
      parsed.values.set(key, next);
      i += 1;
    }
  }
  return parsed;
}

function numberArg(parsed, key, fallback) {
  const value = Number(parsed.values.get(key));
  return Number.isFinite(value) ? value : fallback;
}

function usage(exitCode = 1) {
  const text = [
    'Usage:',
    '  node scripts/analyze-malendo-gsc-export.mjs --pages path/to/pages.csv',
    '  node scripts/analyze-malendo-gsc-export.mjs --pages path/to/pages.csv --queries path/to/queries.csv',
    '  node scripts/analyze-malendo-gsc-export.mjs --pages path/to/pages.csv --markdown',
    '  node scripts/analyze-malendo-gsc-export.mjs --pages path/to/pages.csv --json',
    '',
    'Optional thresholds:',
    '  --meaningful-clicks 3',
    '  --meaningful-impressions 100',
    '  --low-ctr 1',
    '  --poor-position 20',
  ].join('\n');
  if (exitCode === 0) console.log(text);
  else console.error(text);
  process.exit(exitCode);
}

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseCsv(raw);
  if (rows.length === 0) {
    return [];
  }
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1)
    .filter((row) => row.some((cell) => String(cell).trim() !== ''))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
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

function pick(row, names) {
  const keys = Object.keys(row);
  for (const name of names) {
    const match = keys.find((key) => normalizeHeader(key) === normalizeHeader(name));
    if (match) {
      return row[match];
    }
  }
  return '';
}

function normalizeHeader(header) {
  return String(header).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function numberValue(value) {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/%$/, '')
    .replace(/,/g, '');
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function parseMetricRow(row, kind) {
  const locator = kind === 'query'
    ? pick(row, ['Query', 'Top queries'])
    : pick(row, ['Page', 'Top pages', 'URL']);
  const clicks = numberValue(pick(row, ['Clicks']));
  const impressions = numberValue(pick(row, ['Impressions']));
  const ctrInput = pick(row, ['CTR']);
  const ctr = ctrInput === '' ? (impressions > 0 ? (clicks / impressions) * 100 : 0) : numberValue(ctrInput);
  const position = numberValue(pick(row, ['Position', 'Average position', 'Avg position']));
  return { locator: String(locator).trim(), clicks, impressions, ctr, position };
}

function classifyUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    try {
      url = new URL(input, 'https://malendo-property.com');
    } catch {
      return 'unknown';
    }
  }

  const pathname = normalizePath(url.pathname);
  if (pathname === '/') return 'homepage';
  if (pathname === '/properties/') return 'properties hub';
  if (pathname === '/contact/') return 'contact page';
  if (pathname === '/submit-your-application/') return 'submit application page';
  if (pathname === '/thailand/phuket/services/property-management/') return 'property management page';
  if (pathname.startsWith('/properties/')) return 'property listing / estate';
  if (pathname.startsWith('/rent-property/')) return 'rent landing page';
  if (pathname.startsWith('/sell-property/')) return 'sell landing page';
  if (pathname.startsWith('/product-category/')) return 'product category page';
  if (pathname.startsWith('/product/')) return 'WooCommerce product page';
  if (pathname.startsWith('/available/')) return 'available archive/page';
  if (pathname.startsWith('/author/') || pathname.startsWith('/users/') || pathname.includes('/user/')) return 'author/user page';
  if (/\/(test|test-2|test-3|about-me-2|advanced-search-form|video-fullscreen-buttons)\/?$/.test(pathname)) return 'demo/test page';
  if (/\/\d{4}\/\d{2}\//.test(pathname) || pathname.startsWith('/category/') || pathname.startsWith('/tag/')) return 'blog/post-like page';
  return 'unknown';
}

function normalizePath(pathname) {
  const value = `/${String(pathname).replace(/^\/+/, '')}`;
  return value.endsWith('/') ? value : `${value}/`;
}

function weightedPosition(rows) {
  const weight = rows.reduce((sum, row) => sum + row.impressions, 0);
  if (weight === 0) {
    const positioned = rows.filter((row) => row.position > 0);
    return positioned.length ? positioned.reduce((sum, row) => sum + row.position, 0) / positioned.length : 0;
  }
  return rows.reduce((sum, row) => sum + (row.position * row.impressions), 0) / weight;
}

function summarizeRows(rows) {
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  return {
    urlCount: rows.length,
    clicks,
    impressions,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    position: weightedPosition(rows),
  };
}

function analyze(pagesPath, queriesPath = '') {
  const pageRows = readCsv(pagesPath)
    .map((row) => parseMetricRow(row, 'page'))
    .filter((row) => row.locator)
    .map((row) => ({ ...row, url: row.locator, type: classifyUrl(row.locator) }));

  const queryRows = queriesPath
    ? readCsv(queriesPath).map((row) => parseMetricRow(row, 'query')).filter((row) => row.locator)
    : [];

  const byType = new Map();
  for (const row of pageRows) {
    if (!byType.has(row.type)) byType.set(row.type, []);
    byType.get(row.type).push(row);
  }

  const groupsByType = Object.fromEntries([...byType.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, rows]) => [type, summarizeRows(rows)]));

  const topPages = [...pageRows].sort(sortByClicksThenImpressions).slice(0, 25);
  const zeroClickWithImpressions = pageRows.filter((row) => row.clicks === 0 && row.impressions > 0).sort(sortByImpressions);
  const zeroValue = pageRows.filter((row) => row.clicks === 0 && row.impressions === 0);
  const goodClicks = pageRows.filter((row) => row.clicks >= thresholds.meaningfulClicks).sort(sortByClicksThenImpressions);
  const highImpressionLowCtr = pageRows
    .filter((row) => row.impressions >= thresholds.meaningfulImpressions && row.ctr < thresholds.lowCtr)
    .sort(sortByImpressions);
  const highImpressionPoorPosition = pageRows
    .filter((row) => row.impressions >= thresholds.meaningfulImpressions && row.position > thresholds.poorPosition)
    .sort(sortByImpressions);

  const recommendations = buildRecommendations(pageRows, {
    goodClicks,
    highImpressionLowCtr,
    highImpressionPoorPosition,
    zeroValue,
  });

  const querySummary = queryRows.length ? {
    totals: summarizeRows(queryRows),
    topQueries: [...queryRows].sort(sortByClicksThenImpressions).slice(0, 25),
    highImpressionLowCtr: queryRows
      .filter((row) => row.impressions >= thresholds.meaningfulImpressions && row.ctr < thresholds.lowCtr)
      .sort(sortByImpressions)
      .slice(0, 25),
  } : null;

  const totals = summarizeRows(pageRows);
  return {
    inputs: {
      pages: path.resolve(pagesPath),
      queries: queriesPath ? path.resolve(queriesPath) : null,
    },
    thresholds,
    totals,
    groupsByUrlType: groupsByType,
    topPages,
    zeroClickWithImpressions: zeroClickWithImpressions.slice(0, 100),
    zeroValueUrls: zeroValue.slice(0, 100),
    pagesWithGoodClicks: goodClicks.slice(0, 100),
    highImpressionLowCtr: highImpressionLowCtr.slice(0, 100),
    highImpressionPoorPosition: highImpressionPoorPosition.slice(0, 100),
    productAndIndexBloatPerformance: indexBloatSummary(pageRows),
    querySummary,
    recommendations,
    warnings: buildWarnings(pageRows, queryRows),
  };
}

function sortByClicksThenImpressions(a, b) {
  return b.clicks - a.clicks || b.impressions - a.impressions || a.position - b.position;
}

function sortByImpressions(a, b) {
  return b.impressions - a.impressions || b.clicks - a.clicks;
}

function buildRecommendations(rows, sets) {
  const keepIndexed = rows.filter((row) => (
    row.clicks >= thresholds.meaningfulClicks ||
    (COMMERCIAL_TYPES.has(row.type) && row.impressions >= thresholds.meaningfulImpressions)
  )).sort(sortByClicksThenImpressions);

  const improveContentMeta = uniqueRows([
    ...sets.highImpressionLowCtr,
    ...sets.highImpressionPoorPosition.filter((row) => COMMERCIAL_TYPES.has(row.type)),
  ]).filter((row) => !INDEX_BLOAT_TYPES.has(row.type)).sort(sortByImpressions);

  const considerNoindex = rows.filter((row) => (
    INDEX_BLOAT_TYPES.has(row.type) &&
    row.clicks === 0 &&
    (row.impressions < thresholds.meaningfulImpressions || row.type === 'demo/test page' || row.type === 'author/user page')
  )).sort(sortByImpressions);

  const humanReview = rows.filter((row) => (
    row.clicks > 0 ||
    COMMERCIAL_TYPES.has(row.type) ||
    (INDEX_BLOAT_TYPES.has(row.type) && row.impressions >= thresholds.meaningfulImpressions)
  )).sort(sortByClicksThenImpressions);

  return {
    keepIndexed: keepIndexed.slice(0, 100),
    improveContentMeta: improveContentMeta.slice(0, 100),
    considerNoindexRemoveFromSitemap: considerNoindex.slice(0, 200),
    needsHumanReview: humanReview.slice(0, 200),
  };
}

function uniqueRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row.url ?? row.locator;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function indexBloatSummary(rows) {
  const result = {};
  for (const type of INDEX_BLOAT_TYPES) {
    const typed = rows.filter((row) => row.type === type);
    result[type] = {
      ...summarizeRows(typed),
      zeroClickUrls: typed.filter((row) => row.clicks === 0).length,
      clickedUrls: typed.filter((row) => row.clicks > 0).length,
    };
  }
  return result;
}

function buildWarnings(pageRows, queryRows) {
  const warnings = [];
  if (pageRows.length === 0) warnings.push('No page rows were parsed. Check the Pages CSV export and column names.');
  if (queryRows.length === 0) warnings.push('No query CSV was provided. Query-level recommendations are unavailable.');
  if (pageRows.some((row) => row.type === 'unknown')) warnings.push('Some URLs were classified as unknown. Review those manually before making indexation decisions.');
  return warnings;
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

function formatPosition(value) {
  return value ? value.toFixed(1) : '0';
}

function rowLabel(row) {
  return row.url ?? row.locator;
}

function printConsole(report) {
  console.log('Malendo GSC indexation analysis');
  console.log(`Pages CSV: ${report.inputs.pages}`);
  console.log(`Queries CSV: ${report.inputs.queries ?? 'not provided'}`);
  console.log('');
  console.log(`URLs: ${report.totals.urlCount}`);
  console.log(`Clicks: ${report.totals.clicks}`);
  console.log(`Impressions: ${report.totals.impressions}`);
  console.log(`CTR: ${formatPercent(report.totals.ctr)}`);
  console.log(`Average position: ${formatPosition(report.totals.position)}`);
  console.log('');
  console.log('URL type performance:');
  for (const [type, summary] of Object.entries(report.groupsByUrlType)) {
    console.log(`- ${type}: ${summary.urlCount} URL(s), ${summary.clicks} clicks, ${summary.impressions} impressions, ${formatPercent(summary.ctr)} CTR, position ${formatPosition(summary.position)}`);
  }
  console.log('');
  console.log('Decision support:');
  console.log(`- Keep indexed: ${report.recommendations.keepIndexed.length}`);
  console.log(`- Improve content/meta: ${report.recommendations.improveContentMeta.length}`);
  console.log(`- Consider noindex/remove from sitemap: ${report.recommendations.considerNoindexRemoveFromSitemap.length}`);
  console.log(`- Needs human review: ${report.recommendations.needsHumanReview.length}`);
  console.log('');
  console.log('Top clicked pages:');
  printRows(report.topPages.slice(0, 10));
  if (report.warnings.length) {
    console.log('');
    console.log('Warnings:');
    report.warnings.forEach((warning) => console.log(`- ${warning}`));
  }
}

function printRows(rows) {
  if (!rows.length) {
    console.log('- None');
    return;
  }
  rows.forEach((row) => {
    console.log(`- ${rowLabel(row)} | ${row.type ?? 'query'} | ${row.clicks} clicks | ${row.impressions} impressions | ${formatPercent(row.ctr)} CTR | pos ${formatPosition(row.position)}`);
  });
}

function markdownTable(rows, headers) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${headers.map((header) => escapeMarkdown(row[header] ?? '')).join(' | ')} |`),
  ].join('\n');
}

function escapeMarkdown(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function pageRowsForMarkdown(rows, limit = 25) {
  return rows.slice(0, limit).map((row) => ({
    URL: rowLabel(row),
    Type: row.type ?? 'query',
    Clicks: row.clicks,
    Impressions: row.impressions,
    CTR: formatPercent(row.ctr),
    Position: formatPosition(row.position),
  }));
}

function printMarkdown(report) {
  const typeRows = Object.entries(report.groupsByUrlType).map(([type, summary]) => ({
    Type: type,
    URLs: summary.urlCount,
    Clicks: summary.clicks,
    Impressions: summary.impressions,
    CTR: formatPercent(summary.ctr),
    Position: formatPosition(summary.position),
  }));

  const lines = [
    '# Malendo GSC Indexation Analysis',
    '',
    '## Executive Summary',
    '',
    `- Pages analyzed: ${report.totals.urlCount}`,
    `- Total clicks: ${report.totals.clicks}`,
    `- Total impressions: ${report.totals.impressions}`,
    `- Average CTR: ${formatPercent(report.totals.ctr)}`,
    `- Average position: ${formatPosition(report.totals.position)}`,
    `- Keep indexed candidates: ${report.recommendations.keepIndexed.length}`,
    `- Improve content/meta candidates: ${report.recommendations.improveContentMeta.length}`,
    `- Consider noindex/remove-from-sitemap candidates: ${report.recommendations.considerNoindexRemoveFromSitemap.length}`,
    `- Human review candidates: ${report.recommendations.needsHumanReview.length}`,
    '',
    '## Data Source Summary',
    '',
    `- Pages CSV: ${escapeMarkdown(report.inputs.pages)}`,
    `- Queries CSV: ${report.inputs.queries ? escapeMarkdown(report.inputs.queries) : 'not provided'}`,
    `- Meaningful clicks threshold: ${report.thresholds.meaningfulClicks}+`,
    `- Meaningful impressions threshold: ${report.thresholds.meaningfulImpressions}+`,
    `- Low CTR threshold: below ${report.thresholds.lowCtr}%`,
    `- Poor position threshold: worse than ${report.thresholds.poorPosition}`,
    '',
    '## URL Type Performance',
    '',
    markdownTable(typeRows, ['Type', 'URLs', 'Clicks', 'Impressions', 'CTR', 'Position']),
    '',
    '## Top Clicked Pages',
    '',
    markdownTable(pageRowsForMarkdown(report.topPages, 25), ['URL', 'Type', 'Clicks', 'Impressions', 'CTR', 'Position']),
    '',
    '## High-Impression Low-CTR Pages',
    '',
    report.highImpressionLowCtr.length ? markdownTable(pageRowsForMarkdown(report.highImpressionLowCtr, 50), ['URL', 'Type', 'Clicks', 'Impressions', 'CTR', 'Position']) : '- None',
    '',
    '## Product / Product Category / Available / Author Performance',
    '',
    markdownTable(Object.entries(report.productAndIndexBloatPerformance).map(([type, summary]) => ({
      Type: type,
      URLs: summary.urlCount,
      Clicks: summary.clicks,
      Impressions: summary.impressions,
      ZeroClickURLs: summary.zeroClickUrls,
      ClickedURLs: summary.clickedUrls,
    })), ['Type', 'URLs', 'Clicks', 'Impressions', 'ZeroClickURLs', 'ClickedURLs']),
    '',
    '## Keep Indexed Recommendations',
    '',
    report.recommendations.keepIndexed.length ? markdownTable(pageRowsForMarkdown(report.recommendations.keepIndexed, 50), ['URL', 'Type', 'Clicks', 'Impressions', 'CTR', 'Position']) : '- None',
    '',
    '## Improve Content/Meta Recommendations',
    '',
    report.recommendations.improveContentMeta.length ? markdownTable(pageRowsForMarkdown(report.recommendations.improveContentMeta, 50), ['URL', 'Type', 'Clicks', 'Impressions', 'CTR', 'Position']) : '- None',
    '',
    '## Consider Noindex / Remove From Sitemap Candidates',
    '',
    report.recommendations.considerNoindexRemoveFromSitemap.length ? markdownTable(pageRowsForMarkdown(report.recommendations.considerNoindexRemoveFromSitemap, 100), ['URL', 'Type', 'Clicks', 'Impressions', 'CTR', 'Position']) : '- None',
    '',
    '## Human Review List',
    '',
    report.recommendations.needsHumanReview.length ? markdownTable(pageRowsForMarkdown(report.recommendations.needsHumanReview, 100), ['URL', 'Type', 'Clicks', 'Impressions', 'CTR', 'Position']) : '- None',
    '',
    '## Exact WP-admin / Yoast Next Steps',
    '',
    '1. Do not noindex any URL with clicks until a human confirms it is not valuable.',
    '2. Review product URLs and product categories with zero clicks before changing Yoast indexation settings.',
    '3. If product/product-category traffic is weak and not lead-generating, noindex through Yoast Search Appearance or taxonomy settings rather than deleting content.',
    '4. Noindex or unpublish demo/test URLs if they have no business value.',
    '5. Review `available` and author/user sitemap exposure in Yoast or plugin settings.',
    '6. Improve titles/meta on high-impression low-CTR commercial pages before noindexing them.',
    '7. Re-submit the sitemap in Google Search Console after cleanup.',
    '8. Re-run this script after Google has time to recrawl.',
    '',
    '## Do-Not-Do Safety Notes',
    '',
    '- Do not bulk noindex URLs with clicks.',
    '- Do not delete WooCommerce products blindly.',
    '- Do not remove indexed pages that bring leads.',
    '- Do not noindex commercial landing pages just because ranking is weak.',
    '- Use Yoast/WP-admin settings for indexation cleanup.',
    '- Re-run live QA after WP-admin changes.',
  ];

  if (report.querySummary) {
    lines.push('', '## Top Queries', '', markdownTable(pageRowsForMarkdown(report.querySummary.topQueries, 25), ['URL', 'Type', 'Clicks', 'Impressions', 'CTR', 'Position']));
  }

  if (report.warnings.length) {
    lines.push('', '## Warnings', '', ...report.warnings.map((warning) => `- ${escapeMarkdown(warning)}`));
  }

  console.log(lines.join('\n'));
}

function main() {
  if (args.flags.has('help')) usage(0);
  const pagesPath = args.values.get('pages');
  const queriesPath = args.values.get('queries') ?? '';
  if (!pagesPath) usage(1);
  if (!fs.existsSync(pagesPath)) throw new Error(`Pages CSV not found: ${pagesPath}`);
  if (queriesPath && !fs.existsSync(queriesPath)) throw new Error(`Queries CSV not found: ${queriesPath}`);

  const report = analyze(pagesPath, queriesPath);
  if (outputMode === 'json') console.log(JSON.stringify(report, null, 2));
  else if (outputMode === 'markdown') printMarkdown(report);
  else printConsole(report);
}

try {
  main();
} catch (error) {
  if (outputMode === 'json') {
    console.log(JSON.stringify({ error: error?.message ?? String(error) }, null, 2));
  } else {
    console.error(`GSC analysis failed: ${error?.message ?? String(error)}`);
  }
  process.exitCode = 1;
}
