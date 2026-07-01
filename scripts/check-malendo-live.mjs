#!/usr/bin/env node

const BASE_URL = 'https://malendo-property.com';
const GA4_ID = 'G-D99Y7TY0LC';
const FETCH_TIMEOUT_MS = 20000;

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

function printSummary() {
  const passCount = checks.filter((check) => check.status === 'PASS').length;
  const warningCount = checks.filter((check) => check.status === 'WARNING').length;
  const failCount = checks.filter((check) => check.status === 'FAIL').length;
  const overall = failCount > 0 ? 'FAIL' : warningCount > 0 ? 'WARNING' : 'PASS';

  console.log(`\nMalendo live QA summary: ${overall}`);
  console.log(`PASS: ${passCount}`);
  console.log(`WARNING: ${warningCount}`);
  console.log(`FAIL: ${failCount}`);

  for (const status of ['FAIL', 'WARNING']) {
    const items = checks.filter((check) => check.status === status);
    if (items.length === 0) {
      continue;
    }

    console.log(`\n${status} items:`);
    for (const item of items) {
      console.log(`- [${item.label}] ${item.url}`);
      console.log(`  ${item.reason}`);
    }
  }
}

async function main() {
  if (typeof fetch !== 'function') {
    console.error('FAIL: This script requires a Node.js runtime with built-in fetch. Use Node.js 18 or newer.');
    process.exitCode = 1;
    return;
  }

  console.log(`Checking live site: ${BASE_URL}`);
  console.log('This script is read-only and does not submit forms or change WordPress.');

  await checkKeyPages();
  await checkBadSubmitUrlSafety();
  await checkGaAndLeadTracking();
  await checkRestUserHardening();
  await checkSellPropertyLinks();
  await checkChromeExtensionContamination();
  await checkKnownEstateCanonicals();
  await checkLegacyBrandContactWarnings();

  printSummary();

  process.exitCode = checks.some((check) => check.status === 'FAIL') ? 1 : 0;
}

main().catch((error) => {
  console.error('FAIL: Unhandled script error');
  console.error(error);
  process.exitCode = 1;
});
