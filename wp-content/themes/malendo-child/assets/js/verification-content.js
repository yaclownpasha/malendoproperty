(function () {
    'use strict';

    var ctaEvents = {
        'developer-check': 'developer_check_request',
        'project-check': 'project_check_request',
        'current-availability': 'project_availability_request',
        'send-documents': 'project_documents_send',
        'compare-projects': 'project_compare_request'
    };

    function sendEvent(eventName, parameters) {
        var payload = Object.assign({
            event_category: 'verification',
            transport_type: 'beacon'
        }, parameters || {});

        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, payload);
            return;
        }

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(Object.assign({ event: eventName }, payload));
    }

    function pagePath() {
        return window.location.pathname || '/';
    }

    function isVisible(element) {
        var style;

        if (!element || element.hidden || element.getAttribute('aria-hidden') === 'true') {
            return false;
        }

        style = window.getComputedStyle ? window.getComputedStyle(element) : null;

        return !style || (style.display !== 'none' && style.visibility !== 'hidden');
    }

    function headingSlug(text, index) {
        var normalizedText = text || '';
        var slug;

        if (typeof normalizedText.normalize === 'function') {
            normalizedText = normalizedText.normalize('NFKD');
        }

        slug = normalizedText
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        return slug || 'section-' + (index + 1);
    }

    function uniqueHeadingId(base, usedIds) {
        var candidate = base;
        var suffix = 2;

        while (usedIds.has(candidate)) {
            candidate = base + '-' + suffix;
            suffix += 1;
        }

        usedIds.add(candidate);
        return candidate;
    }

    function tocContentRoot(toc) {
        return toc.closest('.malendo-verification-content');
    }

    function buildToc(toc) {
        var root = tocContentRoot(toc);
        var list = toc.querySelector('[data-malendo-verification-toc-list]');
        var headings;
        var headingSet;
        var usedIds = new Set();

        if (!root || !list) {
            return;
        }

        headings = Array.prototype.slice.call(root.querySelectorAll('h2, h3')).filter(function (heading) {
            return !toc.contains(heading) &&
                !heading.closest('header, footer, nav, aside, .widget, .widget-area, .sidebar, [role="complementary"], [role="navigation"]') &&
                isVisible(heading) &&
                heading.textContent.trim() !== '';
        });

        if (headings.length === 0) {
            return;
        }

        headingSet = new Set(headings);
        document.querySelectorAll('[id]').forEach(function (element) {
            if (!headingSet.has(element) && element.id) {
                usedIds.add(element.id);
            }
        });

        headings.forEach(function (heading, index) {
            var existingId = (heading.id || '').trim();
            var id = existingId && !usedIds.has(existingId) ? existingId : uniqueHeadingId(headingSlug(heading.textContent, index), usedIds);
            var item = document.createElement('li');
            var link = document.createElement('a');

            if (id === existingId) {
                usedIds.add(id);
            }

            heading.id = id;
            item.className = 'malendo-verification-toc__item malendo-verification-toc__item--' + heading.tagName.toLowerCase();
            link.href = '#' + encodeURIComponent(id);
            link.textContent = heading.textContent.trim();
            item.appendChild(link);
            list.appendChild(item);
        });

        toc.hidden = false;
    }

    function bindVerificationCtas() {
        document.querySelectorAll('[data-malendo-verification-cta]').forEach(function (cta) {
            var ctaType = cta.getAttribute('data-malendo-verification-cta') || '';

            if (!ctaEvents[ctaType] || cta.getAttribute('data-malendo-verification-bound') === '1') {
                return;
            }

            cta.setAttribute('data-malendo-verification-bound', '1');
            cta.addEventListener('click', function () {
                var parameters = {
                    cta_type: ctaType,
                    page_path: pagePath()
                };

                sendEvent('verification_cta_click', parameters);
                sendEvent(ctaEvents[ctaType], parameters);
            });
        });
    }

    function prepareSourceLinks() {
        document.querySelectorAll('.malendo-source-table a[href]').forEach(function (link) {
            var url;
            var rel;

            try {
                url = new URL(link.href, window.location.href);
            } catch (error) {
                return;
            }

            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                return;
            }

            rel = new Set((link.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
            rel.add('noopener');
            rel.add('noreferrer');
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', Array.from(rel).join(' '));

            if (link.getAttribute('data-malendo-verification-bound') === '1') {
                return;
            }

            link.setAttribute('data-malendo-verification-bound', '1');
            link.addEventListener('click', function () {
                sendEvent('verification_source_click', {
                    page_path: pagePath(),
                    source_host: url.hostname.toLowerCase()
                });
            });
        });
    }

    function init() {
        document.querySelectorAll('[data-malendo-verification-toc]').forEach(buildToc);
        bindVerificationCtas();
        prepareSourceLinks();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
}());
