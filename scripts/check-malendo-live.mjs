#!/usr/bin/env node

const BASE_URL = 'https://malendo-property.com';
const GA4_ID = 'G-D99Y7TY0LC';
const FETCH_TIMEOUT_MS = 20000;

const outputMode = getOutputMode(process.argv.slice(2));

const keyPages = [
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

const expectedSubmitPages = [
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

const badSubmitNeedles = [
  'https://malendo.property/submit-your-application/',
  'http://malendo.property/submit-your-application/',
  'drunkentiki.com',
];

const legacyWarningNeedles = [
  'Malendo.property',
  'info@malendo.property',
  'http://malendo.property',
];

const oldSellLinks = [
  '/sell-property/sell-apartments',
  '/sell-property/sell-bungalows',
  '/sell-property/sell-warehouses-factories',
];

const replacementSellLinks = [
  '/sell-property/sell-apartment/',
  '/sell-property/sell-bungalow/',
  '/sell-property/sell-warehouse-factory/',
];

const chromeExtensionEstateUrls = [
  '/properties/thailand/phuket/rent/carla-villa/',
  '/properties/thailand/phuket/rent/batterfly/',
  '/properties/thailand/phuket/rent/the-kris/',
  '/properties/thailand/phuket/rent/deluxe-mountain-view/',
  '/properties/thailand/phuket/sell/ozone-condo-kata/',
  '/properties/thailand/phuket/sell/sea-and-sky-condo/',
  '/properties/thailand/phuket/rent/splendid-sea-view-resort/',
  '/properties/thailand/phuket/rent/splendid-sea-view-resort-2/',
  '/properties/thailand/phuket/rent/splendid-sea-view-resort-3/',
  '/properties/thailand/phuket/rent/brand-new-luxury-villa-8261/',
  '/properties/thailand/phuket/rent/tropical-castle/',
  '/properties/thailand/phuket/rent/chic-condo/',
  '/properties/thailand/phuket/rent/villa-chalong/',
  '/properties/thailand/phuket/rent/nunan-villa-select/',
];

const canonicalEstateUrls = [
  '/properties/thailand/phuket/sell/ozone-condo-kata/',
  '/properties/thailand/phuket/sell/sea-and-sky-condo/',
  '/properties/thailand/phuket/sell/kata-sea-view-villas/',
  '/properties/thailand/phuket/sell/bluepoint-luxury-condominiums-5065/',
  '/properties/thailand/phuket/sell/bluepoint-luxury-condominiums-5069/',
  '/properties/thailand/phuket/sell/kamala-oceana-6/',
  '/properties/thailand/phuket/sell/kamala-oceana-5/',
  '/properties/thailand/phuket/sell/kamala-oceana-2/',
  '/properties/thailand/phuket/sell/kamala-oceana-19/',
  '/properties/thailand/phuket/sell/kamala-oceana-29/',
  '/properties/thailand/phuket/sell/privilege/',
  '/properties/thailand/phuket/sell/garden-properties-3/',
  '/properties/thailand/phuket/sell/garden-properties-6/',
  '/properties/thailand/phuket/sell/bright-condo-bangtao-10221/',
  '/properties/thailand/phuket/sell/bright-condo-bangtao-10219/',
  '/properties/thailand/phuket/sell/bright-condo-bangtao-10217/',
  '/properties/thailand/phuket/sell/bright-condo-bangtao-10207/',
  '/properties/thailand/phuket/sell/bright-condo-bangtao-10211/',
  '/properties/thailand/phuket/sell/bright-condo-bangtao-10214/',
  '/properties/thailand/phuket/sell/bright-condo-bangtao-10182/',
  '/properties/thailand/phuket/sell/bright-condo-bangtao/',
];

const restUserEndpoints = [
  '/wp-json/wp/v2/users',
  '/wp-json/wp/v2/users/1',
];

const checks = [];
const pageCache = new Map();

function getOutputMode(args) {
  if (args.includes('--json')) {
    return 'json';
  }

  if (args.includes('--markdown')) {
    return 'markdown';
  }

  return 'console';
}

function absoluteUrl(pathOrUrl) {
  return pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE_URL}${pathOrUrl}`;
}

function addCheck(status, label, url, reason) {
  checks.push({ status, label, url, reason });
}

async function fetchUrl(pathOrUrl, options = {}) {
  const url = absoluteUrl(pathOrUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: options.redirect ?? 'follow',
      headers: {
        'user-agent': 'MalendoLiveQAScript/1.0 (+https://malendo-property.com)',
        accept: options.accept ?? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    const text = await response.text();
    return { ok: true, url, finalUrl: response.url, status: response.status, text, response };
  } catch (error) {
    return { ok: false, url, status: 0, text: '', error };
  } finally {
    clearTimeout(timeout);
  }
}

async function getPage(path) {
  if (!pageCache.has(path)) {
    pageCache.set(path, await fetchUrl(path));
  }
  return pageCache.get(path);
}

function includesAny(html, needles) {
  return needles.filter((needle) => html.includes(needle));
}

function extractCanonical(html) {
  const linkMatches = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of linkMatches) {
    if (!/\brel\s*=\s*['"][^'"]*canonical[^'"]*['"]/i.test(tag)) {
      continue;
    }
    const hrefMatch = tag.match(/\bhref\s*=\s*['"]([^'"]+)['"]/i);
    if (hrefMatch) {
      return hrefMatch[1];
    }
  }
  return '';
}

function looksLikePublicUserJson(status, text) {
  if (status !== 200) {
    return false;
  }

  try {
    const data = JSON.parse(text);
    const users = Array.isArray(data) ? data : [data];
    return users.some((user) => user && typeof user === 'object' && (
      Object.prototype.hasOwnProperty.call(user, 'id') ||
      Object.prototype.hasOwnProperty.call(user, 'slug') ||
      Object.prototype.hasOwnProperty.call(user, 'name') ||
      Object.prototype.hasOwnProperty.call(user, 'link')
    ));
  } catch {
    return /"(?:id|slug|name|link)"\s*:/.test(text);
  }
}

async function checkKeyPages() {
  for (const path of keyPages) {
    const result = await getPage(path);
    if (!result.ok) {
      addCheck('FAIL', 'Key page fetch', result.url, result.error?.message ?? 'Fetch failed');
      continue;
    }

    if (result.status === 200) {
      addCheck('PASS', 'Key page HTTP 200', result.url, `HTTP ${result.status}`);
    } else {
      addCheck('FAIL', 'Key page HTTP 200', result.url, `Expected 200, got HTTP ${result.status}`);
    }
  }
}

async function checkBadSubmitUrlSafety() {
  for (const path of keyPages) {
    const result = await getPage(path);
    if (!result.ok) {
      continue;
    }

    const badMatches = includesAny(result.text, badSubmitNeedles);
    if (badMatches.length > 0) {
      addCheck('FAIL', 'Bad submit URL safety', result.url, `Found ${badMatches.join(', ')}`);
    } else {
      addCheck('PASS', 'Bad submit URL safety', result.url, 'No bad submit URL or drunkentiki.com found');
    }
  }

  for (const path of expectedSubmitPages) {
    const result = await getPage(path);
    if (!result.ok || result.status !== 200) {
      continue;
    }

    if (result.text.includes('https://malendo-property.com/submit-your-application/')) {
      addCheck('PASS', 'Correct submit URL present', result.url, 'Correct Submit/Application URL found');
    } else {
      addCheck('WARNING', 'Correct submit URL present', result.url, 'Correct Submit/Application URL not found on sampled page');
    }
  }
}

async function checkGaAndLeadTracking() {
  for (const path of keyPages) {
    const result = await getPage(path);
    if (!result.ok || result.status !== 200) {
      continue;
    }

    if (result.text.includes(GA4_ID)) {
      addCheck('PASS', 'GA4 tag present', result.url, `${GA4_ID} found`);
    } else {
      addCheck('FAIL', 'GA4 tag present', result.url, `${GA4_ID} not found`);
    }

    if (result.text.includes('lead-events.js')) {
      addCheck('PASS', 'lead-events.js present', result.url, 'lead-events.js found');
    } else {
      addCheck('FAIL', 'lead-events.js present', result.url, 'lead-events.js not found');
    }
  }
}

async function checkRestUserHardening() {
  for (const path of restUserEndpoints) {
    const result = await fetchUrl(path, { accept: 'application/json,*/*;q=0.8' });
    if (!result.ok) {
      addCheck('WARNING', 'REST users hardening', result.url, result.error?.message ?? 'Fetch failed');
      continue;
    }

    if ([401, 403, 404].includes(result.status)) {
      addCheck('PASS', 'REST users hardening', result.url, `HTTP ${result.status}`);
    } else if (looksLikePublicUserJson(result.status, result.text)) {
      addCheck('FAIL', 'REST users hardening', result.url, 'HTTP 200 appears to expose user JSON');
    } else {
      addCheck('PASS', 'REST users hardening', result.url, `HTTP ${result.status}, no obvious public user JSON`);
    }
  }
}

async function checkSellPropertyLinks() {
  const sampledHtml = [];
  for (const path of keyPages) {
    const result = await getPage(path);
    if (result.ok) {
      sampledHtml.push(result.text);
    }
  }
  const combinedHtml = sampledHtml.join('\n');

  for (const path of oldSellLinks) {
    const result = await fetchUrl(path);
    const linkedInSample = combinedHtml.includes(path) || combinedHtml.includes(absoluteUrl(path));

    if (result.ok && result.status === 404) {
      addCheck('PASS', 'Old sell link cleanup', result.url, 'Old URL returns 404');
    } else if (!linkedInSample) {
      addCheck('PASS', 'Old sell link cleanup', absoluteUrl(path), `Old URL not found in sampled HTML${result.ok ? `; direct HTTP ${result.status}` : ''}`);
    } else {
      addCheck('FAIL', 'Old sell link cleanup', absoluteUrl(path), `Old URL appears in sampled HTML and direct HTTP ${result.status || 'fetch failed'}`);
    }
  }

  for (const path of replacementSellLinks) {
    const result = await fetchUrl(path);
    if (result.ok && result.status === 200) {
      addCheck('PASS', 'Replacement sell URL', result.url, 'HTTP 200');
    } else {
      addCheck('FAIL', 'Replacement sell URL', result.url, `Expected HTTP 200, got ${result.status || result.error?.message}`);
    }
  }
}

async function checkChromeExtensionContamination() {
  for (const path of chromeExtensionEstateUrls) {
    const result = await fetchUrl(path);
    if (!result.ok) {
      addCheck('FAIL', 'Chrome extension contamination', result.url, result.error?.message ?? 'Fetch failed');
      continue;
    }

    const matches = includesAny(result.text, ['chrome-extension://', 'hiro-wallet-provider']);
    if (matches.length > 0) {
      addCheck('FAIL', 'Chrome extension contamination', result.url, `Found ${matches.join(', ')}`);
    } else {
      addCheck('PASS', 'Chrome extension contamination', result.url, 'No chrome-extension or hiro-wallet-provider found');
    }
  }
}

async function checkKnownEstateCanonicals() {
  for (const path of canonicalEstateUrls) {
    const result = await fetchUrl(path);
    if (!result.ok) {
      addCheck('FAIL', 'Estate canonical', result.url, result.error?.message ?? 'Fetch failed');
      continue;
    }

    const canonical = extractCanonical(result.text);
    if (!canonical) {
      addCheck('FAIL', 'Estate canonical', result.url, 'No canonical tag found');
      continue;
    }

    if (canonical.includes('?post_type=estate&p=')) {
      addCheck('FAIL', 'Estate canonical', result.url, `Canonical uses query URL: ${canonical}`);
    } else if (canonical.includes('malendo.property')) {
      addCheck('FAIL', 'Estate canonical', result.url, `Canonical points to old domain: ${canonical}`);
    } else {
      addCheck('PASS', 'Estate canonical', result.url, `Canonical OK: ${canonical}`);
    }
  }
}

async function checkLegacyBrandContactWarnings() {
  const warningPaths = Array.from(new Set([
    ...keyPages,
    ...chromeExtensionEstateUrls,
    ...canonicalEstateUrls,
  ]));

  for (const path of warningPaths) {
    const result = await getPage(path);
    if (!result.ok || result.status !== 200) {
      continue;
    }

    const matches = includesAny(result.text, legacyWarningNeedles);
    if (matches.length > 0) {
      addCheck('WARNING', 'Legacy brand/contact cleanup', result.url, `Found ${matches.join(', ')}`);
    }
  }
}

function countByStatus() {
  return {
    pass: checks.filter((check) => check.status === 'PASS').length,
    warning: checks.filter((check) => check.status === 'WARNING').length,
    fail: checks.filter((check) => check.status === 'FAIL').length,
  };
}

function overallStatus(counts) {
  if (counts.fail > 0) {
    return 'FAIL';
  }

  if (counts.warning > 0) {
    return 'WARNING';
  }

  return 'PASS';
}

function groupChecks() {
  const failures = checks.filter((check) => check.status === 'FAIL');
  const warnings = checks.filter((check) => check.status === 'WARNING');
  const passes = checks.filter((check) => check.status === 'PASS');

  const criticalLabels = new Set([
    'Key page fetch',
    'Key page HTTP 200',
    'Bad submit URL safety',
    'GA4 tag present',
    'lead-events.js present',
    'REST users hardening',
  ]);

  const wpAdminLabels = new Set([
    'Correct submit URL present',
    'Old sell link cleanup',
    'Replacement sell URL',
  ]);

  const passedSafetyLabels = new Set([
    'Key page HTTP 200',
    'Bad submit URL safety',
    'Correct submit URL present',
    'GA4 tag present',
    'lead-events.js present',
    'REST users hardening',
    'Old sell link cleanup',
    'Replacement sell URL',
  ]);

  return {
    criticalFailures: failures.filter((check) => criticalLabels.has(check.label)),
    wpAdminCleanupFailures: failures.filter((check) => wpAdminLabels.has(check.label)),
    seoCanonicalFailures: failures.filter((check) => check.label === 'Estate canonical'),
    contentHygieneFailures: failures.filter((check) => check.label === 'Chrome extension contamination'),
    otherFailures: failures.filter((check) => (
      !criticalLabels.has(check.label) &&
      !wpAdminLabels.has(check.label) &&
      check.label !== 'Estate canonical' &&
      check.label !== 'Chrome extension contamination'
    )),
    warnings,
    passedSafetyChecks: passes.filter((check) => passedSafetyLabels.has(check.label)),
  };
}

function summarizeByLabel(items) {
  const labelCounts = new Map();
  for (const item of items) {
    labelCounts.set(item.label, (labelCounts.get(item.label) ?? 0) + 1);
  }

  return Array.from(labelCounts.entries()).map(([label, count]) => ({ label, count }));
}

function buildNextHumanActions(groups) {
  const actions = [];

  if (groups.criticalFailures.length > 0) {
    actions.push('Fix critical safety failures first, then rerun this script before any further deploy work.');
  }

  if (groups.wpAdminCleanupFailures.length > 0) {
    actions.push('Fix broken or missing WP admin, MyHome, menu, or content URLs reported under WP-admin cleanup failures.');
  }

  if (groups.contentHygieneFailures.length > 0) {
    actions.push('Open the affected estate pages in WordPress and remove chrome-extension and hiro-wallet-provider snippets from the estate content or imported fields.');
  }

  if (groups.seoCanonicalFailures.length > 0) {
    actions.push('Open the affected sell estates in WordPress and clear or correct Yoast canonical URL overrides so each canonical uses the clean pretty URL.');
  }

  if (groups.warnings.length > 0) {
    actions.push('Clean legacy Malendo.property, info@malendo.property, and http://malendo.property references in WP admin, Yoast, MyHome, user profiles, and content after confirming the correct values.');
  }

  if (actions.length === 0) {
    actions.push('No human cleanup is currently required by this script.');
  }

  return actions;
}

function buildRecommendedCodexAction(groups) {
  if (groups.criticalFailures.length > 0) {
    return 'Review whether any critical failure came from Git or deploy configuration before opening another production PR.';
  }

  if (
    groups.wpAdminCleanupFailures.length > 0 ||
    groups.contentHygieneFailures.length > 0 ||
    groups.seoCanonicalFailures.length > 0 ||
    groups.warnings.length > 0
  ) {
    return 'No immediate Codex/Git change. Rerun this script after WP-admin cleanup, then remove the temporary Submit URL safety patch only after the real source is fixed and verified.';
  }

  return 'No Codex action needed.';
}

function temporarySubmitPatchStatus(groups) {
  const badSubmitFailures = groups.criticalFailures.filter((check) => check.label === 'Bad submit URL safety');
  if (badSubmitFailures.length > 0) {
    return {
      needed: true,
      reason: 'Yes. Bad Submit/Application URL output is still reaching rendered HTML, so the safety patch is not enough or cache/source cleanup is incomplete.',
    };
  }

  return {
    needed: true,
    reason: 'Yes. Keep it until the real WP admin/MyHome/menu source is fixed and verified. Passing rendered checks alone does not prove the source has been cleaned.',
  };
}

function buildReport() {
  const counts = countByStatus();
  const overall = overallStatus(counts);
  const groups = groupChecks();

  return {
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    overall,
    counts,
    groups,
    summaries: {
      passedSafetyChecks: summarizeByLabel(groups.passedSafetyChecks),
      warnings: summarizeByLabel(groups.warnings),
      failures: summarizeByLabel([
        ...groups.criticalFailures,
        ...groups.wpAdminCleanupFailures,
        ...groups.seoCanonicalFailures,
        ...groups.contentHygieneFailures,
        ...groups.otherFailures,
      ]),
    },
    knownWpAdminTasks: [
      'Fix the real Submit/Application URL source in WP admin, MyHome, menus, or database options before removing the temporary child-theme safety patch.',
      'Remove chrome-extension and hiro-wallet-provider snippets from affected estate descriptions or imported fields.',
      'Fix per-estate Yoast canonical URL overrides that point to ?post_type=estate&p= query URLs.',
      'Clean legacy Malendo.property, info@malendo.property, and http://malendo.property references after confirming official replacement values.',
    ],
    temporarySubmitUrlSafetyPatch: temporarySubmitPatchStatus(groups),
    nextHumanActions: buildNextHumanActions(groups),
    recommendedCodexAction: buildRecommendedCodexAction(groups),
  };
}

function printItemList(items) {
  if (items.length === 0) {
    console.log('- None');
    return;
  }

  for (const item of items) {
    console.log(`- [${item.label}] ${item.url}`);
    console.log(`  ${item.reason}`);
  }
}

function printPassedSafetySummary(items) {
  const summary = summarizeByLabel(items);
  if (summary.length === 0) {
    console.log('- None');
    return;
  }

  for (const item of summary) {
    console.log(`- ${item.label}: ${item.count} passed`);
  }
}

function printConsoleReport(report) {
  console.log(`\nMalendo live QA summary: ${report.overall}`);
  console.log(`PASS: ${report.counts.pass}`);
  console.log(`WARNING: ${report.counts.warning}`);
  console.log(`FAIL: ${report.counts.fail}`);

  console.log('\nCritical FAIL items:');
  printItemList(report.groups.criticalFailures);

  console.log('\nWP-admin cleanup failures:');
  printItemList(report.groups.wpAdminCleanupFailures);

  console.log('\nSEO/canonical failures:');
  printItemList(report.groups.seoCanonicalFailures);

  console.log('\nContent hygiene failures:');
  printItemList(report.groups.contentHygieneFailures);

  if (report.groups.otherFailures.length > 0) {
    console.log('\nOther failures:');
    printItemList(report.groups.otherFailures);
  }

  console.log('\nWarnings:');
  printItemList(report.groups.warnings);

  console.log('\nPassed safety checks:');
  printPassedSafetySummary(report.groups.passedSafetyChecks);

  console.log('\nKnown WP-admin tasks:');
  for (const task of report.knownWpAdminTasks) {
    console.log(`- ${task}`);
  }

  console.log('\nTemporary Submit URL safety patch:');
  console.log(`- ${report.temporarySubmitUrlSafetyPatch.reason}`);

  console.log('\nNext human actions:');
  for (const action of report.nextHumanActions) {
    console.log(`- ${action}`);
  }

  console.log('\nRecommended next Codex action:');
  console.log(`- ${report.recommendedCodexAction}`);
}

function markdownItemList(items) {
  if (items.length === 0) {
    return '- None';
  }

  return items.map((item) => (
    `- **${escapeMarkdown(item.label)}**: ${escapeMarkdown(item.url)}\n  - ${escapeMarkdown(item.reason)}`
  )).join('\n');
}

function markdownSummaryList(items) {
  const summary = summarizeByLabel(items);
  if (summary.length === 0) {
    return '- None';
  }

  return summary.map((item) => `- ${escapeMarkdown(item.label)}: ${item.count} passed`).join('\n');
}

function escapeMarkdown(value) {
  return String(value).replace(/\|/g, '\\|');
}

function printMarkdownReport(report) {
  const lines = [
    '# Malendo Live QA Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Overall status: **${report.overall}**`,
    '',
    '| Status | Count |',
    '| --- | ---: |',
    `| PASS | ${report.counts.pass} |`,
    `| WARNING | ${report.counts.warning} |`,
    `| FAIL | ${report.counts.fail} |`,
    '',
    '## Critical FAIL Items',
    '',
    markdownItemList(report.groups.criticalFailures),
    '',
    '## WP-admin Cleanup Failures',
    '',
    markdownItemList(report.groups.wpAdminCleanupFailures),
    '',
    '## SEO/Canonical Failures',
    '',
    markdownItemList(report.groups.seoCanonicalFailures),
    '',
    '## Content Hygiene Failures',
    '',
    markdownItemList(report.groups.contentHygieneFailures),
  ];

  if (report.groups.otherFailures.length > 0) {
    lines.push('', '## Other Failures', '', markdownItemList(report.groups.otherFailures));
  }

  lines.push(
    '',
    '## Warnings',
    '',
    markdownItemList(report.groups.warnings),
    '',
    '## Passed Safety Checks',
    '',
    markdownSummaryList(report.groups.passedSafetyChecks),
    '',
    '## Known WP-admin Tasks',
    '',
    report.knownWpAdminTasks.map((task) => `- ${escapeMarkdown(task)}`).join('\n'),
    '',
    '## Temporary Submit URL Safety Patch',
    '',
    `- ${escapeMarkdown(report.temporarySubmitUrlSafetyPatch.reason)}`,
    '',
    '## Recommended Next Human Actions',
    '',
    report.nextHumanActions.map((action) => `- ${escapeMarkdown(action)}`).join('\n'),
    '',
    '## Recommended Next Codex Action',
    '',
    `- ${escapeMarkdown(report.recommendedCodexAction)}`,
  );

  console.log(lines.join('\n'));
}

function printJsonReport(report) {
  console.log(JSON.stringify(report, null, 2));
}

function printReport(report) {
  if (outputMode === 'json') {
    printJsonReport(report);
    return;
  }

  if (outputMode === 'markdown') {
    printMarkdownReport(report);
    return;
  }

  printConsoleReport(report);
}

async function main() {
  if (typeof fetch !== 'function') {
    const message = 'FAIL: This script requires a Node.js runtime with built-in fetch. Use Node.js 18 or newer.';
    if (outputMode === 'json') {
      console.log(JSON.stringify({
        baseUrl: BASE_URL,
        generatedAt: new Date().toISOString(),
        overall: 'FAIL',
        counts: { pass: 0, warning: 0, fail: 1 },
        groups: {
          criticalFailures: [{ status: 'FAIL', label: 'Runtime', url: BASE_URL, reason: message }],
          wpAdminCleanupFailures: [],
          seoCanonicalFailures: [],
          contentHygieneFailures: [],
          otherFailures: [],
          warnings: [],
          passedSafetyChecks: [],
        },
      }, null, 2));
    } else {
      console.error(message);
    }
    process.exitCode = 1;
    return;
  }

  if (outputMode === 'console') {
    console.log(`Checking live site: ${BASE_URL}`);
    console.log('This script is read-only and does not submit forms or change WordPress.');
  }

  await checkKeyPages();
  await checkBadSubmitUrlSafety();
  await checkGaAndLeadTracking();
  await checkRestUserHardening();
  await checkSellPropertyLinks();
  await checkChromeExtensionContamination();
  await checkKnownEstateCanonicals();
  await checkLegacyBrandContactWarnings();

  const report = buildReport();
  printReport(report);

  process.exitCode = report.counts.fail > 0 ? 1 : 0;
}

main().catch((error) => {
  if (outputMode === 'json') {
    console.log(JSON.stringify({
      baseUrl: BASE_URL,
      generatedAt: new Date().toISOString(),
      overall: 'FAIL',
      counts: { pass: 0, warning: 0, fail: 1 },
      groups: {
        criticalFailures: [{ status: 'FAIL', label: 'Unhandled script error', url: BASE_URL, reason: error?.message ?? String(error) }],
        wpAdminCleanupFailures: [],
        seoCanonicalFailures: [],
        contentHygieneFailures: [],
        otherFailures: [],
        warnings: [],
        passedSafetyChecks: [],
      },
    }, null, 2));
  } else {
    console.error('FAIL: Unhandled script error');
    console.error(error);
  }
  process.exitCode = 1;
});
