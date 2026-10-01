(() => {
    'use strict';
    const grid = document.getElementById('dealsGrid');
    const status = document.getElementById('dealsStatus');
    if (!grid || !status) return;

    const MAX_AGE_MS = 24 * 60 * 60 * 1000;
    const controls = document.getElementById('dealsControls');
    const genreSelect = document.getElementById('dealsGenre');
    const ratingSelect = document.getElementById('dealsRating');
    const sortSelect = document.getElementById('dealsSort');
    const resetButton = document.getElementById('dealsReset');
    const results = document.getElementById('dealsResults');
    const reviewNote = document.getElementById('dealsReviewNote');
    const empty = document.getElementById('dealsEmpty');
    let currentData;
    let expiryTimer;

    function showFallback(message) {
        grid.replaceChildren();
        status.textContent = message;
        if (controls) controls.hidden = true;
        if (empty) empty.hidden = true;
        if (results) results.textContent = '';
        if (reviewNote) reviewNote.textContent = '';
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

    function normalized(value) {
        return String(value || '').normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]/gu, '');
    }

    function reviewAsin(value) {
        try {
            const url = new URL(value);
            if (url.protocol !== 'https:' || !/^(www\.)?amazon\.com$/.test(url.hostname)) return null;
            const match = url.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i);
            return match ? match[1].toUpperCase() : null;
        } catch (_) { return null; }
    }

    function withReviews(books, reviews) {
        return books.map(book => {
            const seenReviews = new Set();
            const matching = reviews.filter(review => {
                if (!review || !Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) return false;
                const asin = reviewAsin(review.amazon_link);
                // A known different edition must not match just because its title is similar.
                const matches = asin ? asin === book.asin :
                    normalized(review.title) === normalized(book.title) &&
                    normalized(review.author) === normalized(book.author);
                if (!matches || (review.id && seenReviews.has(review.id))) return false;
                if (review.id) seenReviews.add(review.id);
                return true;
            });
            return {
                ...book,
                genres: Array.isArray(book.genres) ? book.genres.filter(g => typeof g === 'string' && g.trim()) : [],
                reviewCount: matching.length,
                rating: matching.length ? matching.reduce((sum, review) => sum + review.rating, 0) / matching.length : null
            };
        });
    }

    function updateGenreOptions(books) {
        if (!genreSelect) return;
        const selected = genreSelect.value;
        const genres = [...new Set(books.flatMap(book => book.genres))].sort((a, b) => a.localeCompare(b));
        // Do not replace a focused native select unless its available options changed.
        const key = JSON.stringify(genres);
        if (genreSelect.dataset.genres !== key) {
            const all = element('option', '', 'All genres');
            all.value = 'all';
            genreSelect.replaceChildren(all, ...genres.map(genre => {
                const option = element('option', '', genre);
                option.value = genre;
                return option;
            }));
            genreSelect.dataset.genres = key;
            genreSelect.value = genres.includes(selected) ? selected : 'all';
        }
    }

    function reviewState() {
        return typeof window.getBookDealReviews === 'function' ? window.getBookDealReviews() : { status: 'unavailable', reviews: [] };
    }

    function updateReviewControls(state, books) {
        const ready = state.status === 'ready';
        const hasRatings = ready && books.some(book => book.reviewCount > 0);
        if (ratingSelect) {
            ratingSelect.disabled = !ready;
            Array.from(ratingSelect.options).forEach(option => {
                option.disabled = /^\d/.test(option.value) && !hasRatings;
            });
            if (!ready || (!hasRatings && /^\d/.test(ratingSelect.value))) ratingSelect.value = 'all';
        }
        if (sortSelect) {
            Array.from(sortSelect.options).forEach(option => {
                option.disabled = ['rating', 'reviews'].includes(option.value) && !hasRatings;
            });
            if (!hasRatings && ['rating', 'reviews'].includes(sortSelect.value)) sortSelect.value = 'featured';
        }
        if (reviewNote) {
            reviewNote.textContent = state.status === 'loading' ? 'Loading community ratings…' : !ready ?
                'Community ratings are temporarily unavailable. You can still browse by genre.' : hasRatings ?
                'Ratings come from Buy Me a Book readers. Unreviewed books appear after rated books when sorting by reviews.' :
                'No community reviews for these books yet. Ratings will appear as readers review them on Buy Me a Book.';
        }
    }

    function render(data) {
        currentData = data;
        clearTimeout(expiryTimer);
        const now = Date.now();
        const checkedAt = Date.parse(data.checkedAt);
        const expiresAt = Math.min(Date.parse(data.expiresAt), checkedAt + MAX_AGE_MS);
        if (!Number.isFinite(checkedAt) || !Number.isFinite(expiresAt) || checkedAt > now || expiresAt <= now) {
            showFallback('Our last selection needs a fresh check. Browse Amazon for the latest Kindle deals.');
            return;
        }
        const seen = new Set();
        const validBooks = (Array.isArray(data.books) ? data.books : []).filter(book => {
            if (!book || !/^[A-Z0-9]{10}$/.test(book.asin) || seen.has(book.asin) ||
                typeof book.title !== 'string' || !book.title.trim() ||
                typeof book.author !== 'string' || !book.author.trim()) return false;
            seen.add(book.asin);
            return true;
        });
        if (!validBooks.length) {
            showFallback('Browse Amazon for the latest Kindle deals while we prepare our next selection.');
            return;
        }
        const state = reviewState();
        const books = withReviews(validBooks, state.status === 'ready' && Array.isArray(state.reviews) ? state.reviews : []);
        updateGenreOptions(books);
        updateReviewControls(state, books);
        if (controls) controls.hidden = false;
        const genre = genreSelect ? genreSelect.value : 'all';
        const rating = ratingSelect ? ratingSelect.value : 'all';
        const sort = sortSelect ? sortSelect.value : 'featured';
        const visible = books.filter(book => (genre === 'all' || book.genres.includes(genre)) &&
            (rating === 'all' || (rating === 'unreviewed' ? !book.reviewCount : book.rating !== null && book.rating >= Number(rating))));
        if (sort === 'rating') visible.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.reviewCount - a.reviewCount || a.title.localeCompare(b.title));
        if (sort === 'reviews') visible.sort((a, b) => b.reviewCount - a.reviewCount || (b.rating ?? -1) - (a.rating ?? -1) || a.title.localeCompare(b.title));
        if (sort === 'title') visible.sort((a, b) => a.title.localeCompare(b.title));
        if (resetButton) resetButton.disabled = genre === 'all' && rating === 'all' && sort === 'featured';
        if (results) results.textContent = 'Showing ' + visible.length + ' of ' + books.length + ' books' + (genre !== 'all' ? ' · ' + genre : '');
        if (empty) empty.hidden = visible.length > 0;
        const cards = visible.map(book => {
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
                element('p', 'deal-rating' + (book.reviewCount ? '' : ' deal-unreviewed'), book.reviewCount ?
                    '★ ' + book.rating.toFixed(1) + '/5 · ' + book.reviewCount + ' community ' + (book.reviewCount === 1 ? 'review' : 'reviews') :
                    state.status === 'ready' ? 'Not yet reviewed by our community' : state.status === 'loading' ? 'Community ratings loading…' : 'Community rating unavailable'),
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
    [genreSelect, ratingSelect, sortSelect].forEach(select => {
        if (select) select.addEventListener('change', () => { if (currentData) render(currentData); });
    });
    if (resetButton) resetButton.addEventListener('click', () => {
        genreSelect.value = 'all';
        ratingSelect.value = 'all';
        sortSelect.value = 'featured';
        if (currentData) render(currentData);
    });
    window.addEventListener('bookreviewschange', () => { if (currentData) render(currentData); });
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
