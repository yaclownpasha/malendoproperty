import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const scriptUrl = new URL('../wp-content/themes/malendo-child/assets/js/lead-events.js', import.meta.url);
const source = await readFile(scriptUrl, 'utf8');
const listeners = new Map();
const events = [];

const document = {
  addEventListener(type, listener) {
    const typeListeners = listeners.get(type) || [];
    typeListeners.push(listener);
    listeners.set(type, typeListeners);
  },
};

const window = {
  location: {
    href: 'https://malendo-property.com/contact/?private=secret',
    origin: 'https://malendo-property.com',
    pathname: '/contact/',
  },
  gtag(command, eventName, payload) {
    assert.equal(command, 'event');
    events.push({ eventName, payload });
  },
};

const context = vm.createContext({
  URL,
  WeakMap,
  document,
  window,
});

function dispatch(type, target, detail = {}) {
  for (const listener of listeners.get(type) || []) {
    listener({ type, target, detail });
  }
}

function anchor(href, text) {
  return {
    innerText: text,
    getAttribute(name) {
      if (name === 'href') return href;
      if (name === 'aria-label' || name === 'title') return '';
      return '';
    },
    closest(selector) {
      return selector === 'a[href]' ? this : null;
    },
  };
}

function cf7Form(formId = '2694') {
  const attributes = {
    action: '/contact/?private=form-secret#wpcf7',
    class: 'wpcf7-form init',
    name: '',
    role: '',
  };
  const wrapper = {
    getAttribute(name) {
      return name === 'data-wpcf7-id' ? formId : '';
    },
    querySelector(selector) {
      return selector === 'form.wpcf7-form' ? form : null;
    },
  };
  const form = {
    id: '',
    tagName: 'FORM',
    getAttribute(name) {
      return attributes[name] || '';
    },
    querySelectorAll() {
      return [];
    },
    closest(selector) {
      return selector === '.wpcf7' ? wrapper : null;
    },
  };

  return { form, wrapper };
}

function ordinaryForm(attributes = {}) {
  return {
    id: attributes.id || '',
    tagName: 'FORM',
    getAttribute(name) {
      return attributes[name] || '';
    },
    querySelectorAll() {
      return [];
    },
    closest() {
      return null;
    },
  };
}

function eventCount(name) {
  return events.filter((event) => event.eventName === name).length;
}

function latestEvent(name) {
  return events.filter((event) => event.eventName === name).at(-1);
}

function assertSafePayload(event) {
  const serialized = JSON.stringify(event.payload);
  const prohibitedKeys = [
    'link_text',
    'link_host',
    'link_path',
    'form_class',
    'form_action_path',
    'href',
    'email',
    'phone',
    'message',
    'name',
  ];

  for (const key of prohibitedKeys) {
    assert.equal(Object.hasOwn(event.payload, key), false, `${event.eventName} contains prohibited key ${key}`);
  }

  assert.doesNotMatch(serialized, /secret|info@example\.com|66888357304|private=/i);
  assert.equal(event.payload.page_path, '/contact/');
}

vm.runInContext(source, context, { filename: 'lead-events.js' });
vm.runInContext(source, context, { filename: 'lead-events-second-load.js' });

for (const type of ['click', 'submit', 'wpcf7mailsent', 'wpcf7invalid', 'wpcf7spam', 'wpcf7mailfailed']) {
  assert.equal(listeners.get(type)?.length, 1, `${type} listener must be bound once`);
}

const clickCases = [
  ['tel:+66888357304', '+66 88 835 7304', 'click_phone', 'phone'],
  ['mailto:info@example.com?subject=Private', 'info@example.com', 'click_email', 'email'],
  ['https://wa.me/66888357304?text=Private', 'WhatsApp +66 88 835 7304', 'click_whatsapp', 'whatsapp'],
  ['https://t.me/example?start=Private', 'Telegram user', 'click_telegram', 'telegram'],
  ['https://malendo-property.com/submit-your-application/?private=secret', 'Submit Application', 'click_submit_application', 'submit_application'],
  ['https://malendo-property.com/properties/private-estate/?private=secret', 'Private Estate Name', 'click_property_card', 'property_card'],
];

for (const [href, text, expectedEvent, ctaType] of clickCases) {
  const before = events.length;
  dispatch('click', anchor(href, text));
  assert.equal(events.length, before + 1);
  assert.equal(events.at(-1).eventName, expectedEvent);
  assert.equal(events.at(-1).payload.cta_type, ctaType);
  assertSafePayload(events.at(-1));
}

assert.equal(eventCount('generate_lead'), 0, 'CTA clicks must not generate leads');

const nonCf7LeadForm = ordinaryForm({
  id: 'contact-request',
  class: 'contact-form',
  action: '/contact/?private=secret',
});
dispatch('submit', nonCf7LeadForm);
assert.equal(latestEvent('form_submit_attempt').payload.funnel, 'lead_form');
assert.equal(latestEvent('form_submit_attempt').payload.form_id, 'unknown');
assert.equal(eventCount('generate_lead'), 0, 'generic form attempts must not generate leads');
assertSafePayload(latestEvent('form_submit_attempt'));

const cartForm = ordinaryForm({ class: 'woocommerce cart', action: '/cart/' });
const attemptsBeforeCart = eventCount('form_submit_attempt');
dispatch('submit', cartForm);
assert.equal(eventCount('form_submit_attempt'), attemptsBeforeCart, 'WooCommerce forms must remain excluded');

const invalid = cf7Form();
dispatch('submit', invalid.form);
dispatch('wpcf7invalid', invalid.wrapper, { contactFormId: 2694, inputs: [{ value: 'info@example.com' }] });
dispatch('wpcf7invalid', invalid.wrapper, { contactFormId: 2694 });
assert.equal(eventCount('form_submit_invalid'), 1);
assert.equal(eventCount('generate_lead'), 0, 'invalid submissions must not generate leads');
assertSafePayload(latestEvent('form_submit_invalid'));

const spam = cf7Form();
dispatch('submit', spam.form);
dispatch('wpcf7spam', spam.wrapper, { contactFormId: 2694 });
assert.equal(eventCount('form_submit_spam'), 1);
assert.equal(eventCount('generate_lead'), 0, 'spam submissions must not generate leads');

const failed = cf7Form();
dispatch('submit', failed.form);
dispatch('wpcf7mailfailed', failed.wrapper, { contactFormId: 2694 });
assert.equal(eventCount('form_submit_failed'), 1);
assert.equal(eventCount('generate_lead'), 0, 'mail failures must not generate leads');

const successful = cf7Form();
dispatch('submit', successful.form);
dispatch('wpcf7mailsent', successful.wrapper, { contactFormId: 2694 });
dispatch('wpcf7mailsent', successful.wrapper, { contactFormId: 2694 });
assert.equal(eventCount('form_submit_success'), 1);
assert.equal(eventCount('generate_lead'), 1, 'duplicate callback must not duplicate generate_lead');
assertSafePayload(latestEvent('form_submit_success'));
assertSafePayload(latestEvent('generate_lead'));

dispatch('submit', successful.form);
dispatch('wpcf7mailsent', successful.wrapper, { contactFormId: 2694 });
assert.equal(eventCount('form_submit_success'), 2);
assert.equal(eventCount('generate_lead'), 2, 'a new submit attempt may generate a new lead');

console.log(`PASS: ${events.length} analytics calls validated`);
console.log('PASS: click and attempt events do not emit generate_lead');
console.log('PASS: CF7 success emits one deduplicated generate_lead per submit attempt');
console.log('PASS: invalid, spam and mail-failed results remain diagnostic only');
console.log('PASS: tested payloads contain categorical values and pathname only');
