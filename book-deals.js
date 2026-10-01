(() => {
    'use strict';
    const grid = document.getElementById('dealsGrid');
    const status = document.getElementById('dealsStatus');
    if (!grid || !status) return;

    const MAX_AGE_MS = 24 * 60 * 60 * 1000;
    let expiryTimer;

    function showFallback(message) {
        grid.replaceChildren();
        status.textContent = message;
    }

    function openDealsFromHash() {
        if (window.location.hash === '#deals' && typeof window.goToTab === 'function') {
            window.goToTab('deals');
            document.getElementById('deals').scrollIntoView({ block: 'start', behavior: 'instant' });
        }
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        node.className = className;
        node.textContent = text;
        return node;
    }

    function render(data) {
        clearTimeout(expiryTimer);
        const now = Date.now();
        const checkedAt = Date.parse(data.checkedAt);
        const expiresAt = Math.min(Date.parse(data.expiresAt), checkedAt + MAX_AGE_MS);
        if (!Number.isFinite(checkedAt) || !Number.isFinite(expiresAt) || checkedAt > now || expiresAt <= now) {
            showFallback('Our last selection needs a fresh check. Browse Amazon for the latest Kindle deals.');
            return;
        }
        const seen = new Set();
        const books = (Array.isArray(data.books) ? data.books : []).filter(book => {
            if (!book || !/^[A-Z0-9]{10}$/.test(book.asin) || seen.has(book.asin) ||
                typeof book.title !== 'string' || !book.title.trim() ||
                typeof book.author !== 'string' || !book.author.trim()) return false;
            seen.add(book.asin);
            return true;
        });
        if (!books.length) {
            showFallback('Browse Amazon for the latest Kindle deals while we prepare our next selection.');
            return;
        }
        const cards = books.map(book => {
            const card = element('article', 'deal-card', '');
            const link = element('a', 'deal-link', 'Check Kindle price on Amazon ↗');
            // Only validated ASINs enter a fixed, trusted Amazon product URL.
            link.href = 'https://www.amazon.com/dp/' + book.asin + '?tag=samuelkimanis-20';
            link.target = '_blank';
            link.rel = 'sponsored noopener';
            link.setAttribute('aria-label', 'Check Kindle price for ' + book.title + ' on Amazon (opens in a new tab)');
            card.append(
                element('p', 'deal-category', (book.category || 'Book selection') + ' · Kindle'),
                element('h3', 'deal-title', book.title),
                element('p', 'deal-author', 'by ' + book.author),
                element('p', 'deal-note', book.note || ''),
                link
            );
            return card;
        });
        grid.replaceChildren(...cards);
        const checked = new Intl.DateTimeFormat('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
        }).format(new Date(checkedAt));
        status.textContent = books.length + ' picks from Kindle Monthly Deals · Checked ' + checked + ' UTC';
        // Expire an already-open page too; a reload must not be required.
        expiryTimer = setTimeout(() => render(data), expiresAt - now + 1);
    }

    async function loadDeals() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch('book-deals.json', { cache: 'no-store', signal: controller.signal });
            if (!response.ok) throw new Error('Deals unavailable');
            render(await response.json());
        } catch (_) {
            showFallback('Our selected books could not load. Browse Amazon for the latest Kindle deals.');
        } finally {
            clearTimeout(timeout);
        }
    }

    openDealsFromHash();
    window.addEventListener('hashchange', openDealsFromHash);
    // Native fragment scrolling runs during page load; align after it, below the sticky navigation.
    window.addEventListener('load', () => {
        if (window.location.hash === '#deals') {
            requestAnimationFrame(() => document.getElementById('deals').scrollIntoView({ block: 'start', behavior: 'instant' }));
        }
    });
    // Refresh after the page returns from the back/forward cache or a sleeping tab.
    window.addEventListener('pageshow', event => { if (event.persisted) loadDeals(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loadDeals(); });
    loadDeals();
})();
