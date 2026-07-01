(function () {
    'use strict';

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

    function leadTypeForEvent(eventName) {
        var leadTypes = {
            click_phone: 'phone',
            click_email: 'email',
            click_whatsapp: 'whatsapp',
            click_telegram: 'telegram',
            click_submit_application: 'submit_application',
            form_submit_attempt: 'form'
        };

        return leadTypes[eventName] || '';
    }

    function sendGenerateLead(sourceEvent) {
        var leadType = leadTypeForEvent(sourceEvent);

        if (!leadType) {
            return;
        }

        sendEvent('generate_lead', {
            lead_type: leadType,
            source_event: sourceEvent
        });
    }

    function cleanText(text) {
        return (text || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 80);
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

    function getFormActionPath(form) {
        var actionUrl = safeUrl(form.getAttribute('action') || '');

        return actionUrl ? actionUrl.pathname : '';
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
            form.getAttribute('action') || '',
            getFormActionPath(form)
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

    function classifyLink(anchor) {
        var href = anchor.getAttribute('href') || '';
        var text = cleanText(anchor.innerText || anchor.getAttribute('aria-label') || anchor.getAttribute('title'));
        var url = safeUrl(href);
        var lowerHref = href.toLowerCase();

        if (lowerHref.indexOf('tel:') === 0) {
            return {
                name: 'click_phone',
                params: {
                    link_text: text
                }
            };
        }

        if (lowerHref.indexOf('mailto:') === 0) {
            return {
                name: 'click_email',
                params: {
                    link_text: text
                }
            };
        }

        if (url && /(^|\.)wa\.me$|(^|\.)whatsapp\.com$/i.test(url.hostname)) {
            return {
                name: 'click_whatsapp',
                params: {
                    link_host: url.hostname,
                    link_text: text
                }
            };
        }

        if (url && /(^|\.)t\.me$|(^|\.)telegram\.me$|(^|\.)telegram\.org$/i.test(url.hostname)) {
            return {
                name: 'click_telegram',
                params: {
                    link_host: url.hostname,
                    link_text: text
                }
            };
        }

        if (isSubmitApplicationLink(url, text)) {
            return {
                name: 'click_submit_application',
                params: {
                    link_host: url ? url.hostname : '',
                    link_path: url ? url.pathname : '',
                    link_text: text
                }
            };
        }

        if (isInternalPropertyUrl(url)) {
            return {
                name: 'click_property_card',
                params: {
                    link_path: url.pathname,
                    link_text: text
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
        sendGenerateLead(classified.name);
    }, true);

    document.addEventListener('submit', function (event) {
        var form = event.target;
        var actionPath;

        if (!form || !form.tagName || form.tagName.toLowerCase() !== 'form') {
            return;
        }

        if (!isLikelyLeadForm(form)) {
            return;
        }

        actionPath = getFormActionPath(form);

        sendEvent('form_submit_attempt', {
            form_id: form.id || '',
            form_class: cleanText(form.getAttribute('class') || ''),
            form_action_path: actionPath
        });
        sendGenerateLead('form_submit_attempt');
    }, true);
}());
