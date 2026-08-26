(function () {
    'use strict';

    if (window.__malendoLeadEventsInitialized) {
        return;
    }

    window.__malendoLeadEventsInitialized = true;

    var formSubmissionStates = new WeakMap();

    function hasGtag() {
        return typeof window.gtag === 'function';
    }

    function sendEvent(eventName, params) {
        var payload = Object.assign({
            event_category: 'lead',
            transport_type: 'beacon'
        }, params || {});

        if (hasGtag()) {
            window.gtag('event', eventName, payload);
            return;
        }

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(Object.assign({ event: eventName }, payload));
    }

    function normalizeText(text) {
        return (text || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function safeUrl(href) {
        try {
            return new URL(href, window.location.href);
        } catch (error) {
            return null;
        }
    }

    function pagePath() {
        return window.location.pathname || '/';
    }

    function isInternalPropertyUrl(url) {
        if (!url || url.origin !== window.location.origin) {
            return false;
        }

        return /\/(estate|property|properties|product)\//i.test(url.pathname);
    }

    function isSubmitApplicationLink(url, text) {
        if (!url) {
            return false;
        }

        return /submit-your-application|submit-listing|submit-property/i.test(url.pathname) ||
            /submit|application|list your property/i.test(text || '');
    }

    function formClosestMatches(form, selector) {
        return !!(form.closest && form.closest(selector));
    }

    function isContactForm7Form(form) {
        return /(^|\s)wpcf7-form(\s|$)/i.test(form.getAttribute('class') || '') ||
            formClosestMatches(form, '.wpcf7');
    }

    function formDescriptor(form) {
        return normalizeText([
            form.id || '',
            form.getAttribute('class') || '',
            form.getAttribute('name') || '',
            form.getAttribute('role') || '',
            form.getAttribute('action') || ''
        ].join(' '));
    }

    function formFieldDescriptor(form) {
        var fields = form.querySelectorAll ? form.querySelectorAll('input, select, textarea, button') : [];
        var values = [];
        var i;

        for (i = 0; i < fields.length; i += 1) {
            values.push(fields[i].getAttribute('name') || '');
            values.push(fields[i].getAttribute('id') || '');
            values.push(fields[i].getAttribute('class') || '');
            values.push(fields[i].getAttribute('type') || '');
        }

        return normalizeText(values.join(' '));
    }

    function isClearlyNonLeadForm(form) {
        var descriptor = formDescriptor(form) + ' ' + formFieldDescriptor(form);

        return /cart|checkout|add-to-cart|woocommerce|orderby|filter|search|sort|product_cat|paged/i.test(descriptor);
    }

    function isLikelyLeadForm(form) {
        var descriptor;

        if (isContactForm7Form(form)) {
            return true;
        }

        if (isClearlyNonLeadForm(form)) {
            return false;
        }

        descriptor = formDescriptor(form);

        return /contact|inquiry|enquiry|request|viewing|submit[\s_-]*application|application|lead/i.test(descriptor);
    }

    function safeFormId(form, detail) {
        var wrapper = formClosestMatches(form, '.wpcf7') ? form.closest('.wpcf7') : null;
        var candidates = [
            detail && detail.contactFormId,
            wrapper && wrapper.getAttribute('data-wpcf7-id'),
            form.id
        ];
        var candidate;
        var match;
        var i;

        for (i = 0; i < candidates.length; i += 1) {
            candidate = String(candidates[i] || '').trim();

            if (/^\d{1,12}$/.test(candidate)) {
                return candidate;
            }

            match = candidate.match(/^wpcf7-f(\d{1,12})(?:-|$)/i);

            if (match) {
                return match[1];
            }

        }

        return 'unknown';
    }

    function eventParameters(form, status, detail) {
        return {
            funnel: 'contact_form_7',
            form_id: safeFormId(form, detail),
            page_path: pagePath(),
            submission_status: status
        };
    }

    function formFromCf7Event(event) {
        var target = event && event.target;

        if (!target) {
            return null;
        }

        if (target.tagName && target.tagName.toLowerCase() === 'form') {
            return target;
        }

        if (target.querySelector) {
            return target.querySelector('form.wpcf7-form');
        }

        return null;
    }

    function handleCf7Result(event, eventName, status, isSuccess) {
        var form = formFromCf7Event(event);
        var state;
        var params;

        if (!form || !isContactForm7Form(form)) {
            return;
        }

        state = formSubmissionStates.get(form);

        // A CF7 result is only attributable after this script observed a real submit attempt.
        if (!state || state.completed) {
            return;
        }

        state.completed = true;
        params = eventParameters(form, status, event.detail || {});
        sendEvent(eventName, params);

        if (isSuccess) {
            sendEvent('generate_lead', params);
        }
    }

    function classifyLink(anchor) {
        var href = anchor.getAttribute('href') || '';
        var text = anchor.innerText || anchor.getAttribute('aria-label') || anchor.getAttribute('title') || '';
        var url = safeUrl(href);
        var lowerHref = href.toLowerCase();

        if (lowerHref.indexOf('tel:') === 0) {
            return {
                name: 'click_phone',
                params: {
                    cta_type: 'phone',
                    page_path: pagePath()
                }
            };
        }

        if (lowerHref.indexOf('mailto:') === 0) {
            return {
                name: 'click_email',
                params: {
                    cta_type: 'email',
                    page_path: pagePath()
                }
            };
        }

        if (url && /(^|\.)wa\.me$|(^|\.)whatsapp\.com$/i.test(url.hostname)) {
            return {
                name: 'click_whatsapp',
                params: {
                    cta_type: 'whatsapp',
                    page_path: pagePath()
                }
            };
        }

        if (url && /(^|\.)t\.me$|(^|\.)telegram\.me$|(^|\.)telegram\.org$/i.test(url.hostname)) {
            return {
                name: 'click_telegram',
                params: {
                    cta_type: 'telegram',
                    page_path: pagePath()
                }
            };
        }

        if (isSubmitApplicationLink(url, text)) {
            return {
                name: 'click_submit_application',
                params: {
                    cta_type: 'submit_application',
                    page_path: pagePath()
                }
            };
        }

        if (isInternalPropertyUrl(url)) {
            return {
                name: 'click_property_card',
                params: {
                    cta_type: 'property_card',
                    page_path: pagePath()
                }
            };
        }

        return null;
    }

    document.addEventListener('click', function (event) {
        var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;

        if (!anchor) {
            return;
        }

        var classified = classifyLink(anchor);

        if (!classified) {
            return;
        }

        sendEvent(classified.name, classified.params);
    }, true);

    document.addEventListener('submit', function (event) {
        var form = event.target;

        if (!form || !form.tagName || form.tagName.toLowerCase() !== 'form') {
            return;
        }

        if (!isLikelyLeadForm(form)) {
            return;
        }

        if (isContactForm7Form(form)) {
            formSubmissionStates.set(form, { completed: false });
        }

        sendEvent('form_submit_attempt', isContactForm7Form(form) ?
            eventParameters(form, 'attempt', {}) : {
                funnel: 'lead_form',
                form_id: 'unknown',
                page_path: pagePath(),
                submission_status: 'attempt'
            });
    }, true);

    document.addEventListener('wpcf7mailsent', function (event) {
        handleCf7Result(event, 'form_submit_success', 'success', true);
    });

    document.addEventListener('wpcf7invalid', function (event) {
        handleCf7Result(event, 'form_submit_invalid', 'invalid', false);
    });

    document.addEventListener('wpcf7spam', function (event) {
        handleCf7Result(event, 'form_submit_spam', 'spam', false);
    });

    document.addEventListener('wpcf7mailfailed', function (event) {
        handleCf7Result(event, 'form_submit_failed', 'mail_failed', false);
    });
}());
