const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const script = readFileSync(new URL('../book-deals.js', `file://${__filename}`), 'utf8');
const initial = JSON.parse(readFileSync(new URL('../book-deals.json', `file://${__filename}`), 'utf8'));
const NOW = Date.parse('2026-10-01T08:00:00Z');

// Small DOM surface: assigning innerHTML is deliberately unsupported.
function node() {
    return {
        children: [], textContent: '', attributes: {}, dataset: {}, value: '', hidden: false, disabled: false, listeners: {},
        get options() { return this.children; },
        addEventListener(event, listener) { this.listeners[event] = listener; },
        append(...children) { this.children.push(...children); },
        replaceChildren(...children) { this.children = children; },
        setAttribute(key, value) { this.attributes[key] = value; },
        set innerHTML(_) { throw new Error('Unsafe HTML insertion'); }
    };
}

async function run(data, { now = NOW, failed = false, reviews = [], reviewStatus = 'ready' } = {}) {
    const grid = node();
    const status = node();
    const timers = [];
    const nodes = Object.fromEntries(['dealsControls', 'dealsGenre', 'dealsRating', 'dealsSort', 'dealsReset', 'dealsResults', 'dealsReviewNote', 'dealsEmpty'].map(id => [id, node()]));
    nodes.dealsGenre.value = nodes.dealsRating.value = 'all';
    nodes.dealsSort.value = 'featured';
    for (const [id, values] of [['dealsRating', ['all', '4.5', '4', '3', 'unreviewed']], ['dealsSort', ['featured', 'rating', 'reviews', 'title']]]) {
        nodes[id].children = values.map(value => ({ value }));
    }
    const windowListeners = {};
    let reviewData = { status: reviewStatus, reviews };
    let clock = now;
    const context = {
        document: {
            getElementById: id => ({ ...nodes, dealsGrid: grid, dealsStatus: status })[id],
            createElement: node,
            addEventListener() {}
        },
        window: {
            location: { hash: '' },
            addEventListener(event, listener) { windowListeners[event] = listener; },
            getBookDealReviews: () => reviewData
        },
        Date: class extends Date { static now() { return clock; } },
        Intl, AbortController, URL,
        setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; },
        clearTimeout() {},
        fetch: async () => {
            if (failed) throw new Error('Offline');
            return { ok: true, json: async () => data };
        }
    };
    vm.runInNewContext(script, context);
    await new Promise(resolve => setImmediate(resolve));
    return { grid, status, timers, nodes, setNow: value => { clock = value; },
        change: (id, value) => { nodes[id].value = value; nodes[id].listeners.change(); },
        setReviews: (reviews, status = 'ready') => { reviewData = { reviews, status }; windowListeners.bookreviewschange(); }
    };
}

test('verified picks retain the site affiliate tag and use safe Kindle links', async () => {
    const { grid, status } = await run(initial);
    assert.equal(grid.children.length, 6);
    assert.match(status.textContent, /Checked 1 Oct 2026/);
    for (const card of grid.children) {
        const link = card.children.at(-1);
        assert.match(link.href, /^https:\/\/www\.amazon\.com\/dp\/[A-Z0-9]{10}\?tag=samuelkimanis-20$/);
        assert.equal(link.rel, 'sponsored noopener');
    }
});

const review = (index, rating, id) => ({ id, rating, title: initial.books[index].title, author: initial.books[index].author, amazon_link: 'https://www.amazon.com/dp/' + initial.books[index].asin });
const titles = result => result.grid.children.map(card => card.children[1].textContent);

test('genre filters include both memoirs and can be reset', async () => {
    const result = await run(initial);
    result.change('dealsGenre', 'Biography & memoir');
    assert.deepEqual(titles(result), ['The House of My Mother', 'No One to Miss Me']);
    assert.match(result.nodes.dealsResults.textContent, /Showing 2 of 6/);
    result.nodes.dealsReset.listeners.click();
    assert.equal(result.grid.children.length, 6);
});

test('genre and minimum rating filters combine, exclude unrated books, and show empty results', async () => {
    const result = await run(initial, { reviews: [review(0, 5, 'a'), review(2, 3, 'b'), review(4, 4, 'c')] });
    result.change('dealsRating', '4.5');
    result.change('dealsGenre', 'Fiction');
    assert.deepEqual(titles(result), ['My Sister’s Keeper']);
    result.change('dealsGenre', 'Biography & memoir');
    assert.equal(result.grid.children.length, 0);
    assert.equal(result.nodes.dealsEmpty.hidden, false);
    assert.equal(result.nodes.dealsControls.hidden, false);
});

test('highest rated and most reviewed use different orders and put unrated books last', async () => {
    const result = await run(initial, { reviews: [review(0, 5, 'a'), review(4, 4, 'b'), review(4, 4, 'c')] });
    result.change('dealsSort', 'rating');
    assert.deepEqual(titles(result).slice(0, 2), ['My Sister’s Keeper', 'The House of My Mother']);
    result.change('dealsSort', 'reviews');
    assert.deepEqual(titles(result).slice(0, 2), ['The House of My Mother', 'My Sister’s Keeper']);
});

test('ratings average unique valid reviews and do not match a different known edition', async () => {
    const rows = [review(0, 5, 'a'), review(0, 3, 'b'), review(0, 5, 'a'), review(0, 9, 'c'), { ...review(0, 1, 'd'), amazon_link: 'https://www.amazon.com/dp/B000000000' }];
    const result = await run(initial, { reviews: rows });
    assert.equal(result.grid.children[0].children[3].textContent, '★ 4.0/5 · 2 community reviews');
});

test('reviews without an ASIN require both normalized title and author to match', async () => {
    const result = await run(initial, { reviews: [
        { id: 'a', title: "MY SISTER'S KEEPER", author: 'Jodi Picoult', rating: 5 },
        { id: 'b', title: "My Sister's Keeper", author: 'A different author', rating: 1 }
    ] });
    assert.equal(result.grid.children[0].children[3].textContent, '★ 5.0/5 · 1 community review');
});

test('no reviews leaves rating-based sorting unavailable and labels books honestly', async () => {
    const result = await run(initial);
    assert.equal(result.nodes.dealsSort.options.find(option => option.value === 'rating').disabled, true);
    assert.match(result.grid.children[0].children[3].textContent, /Not yet reviewed/);
    result.change('dealsRating', 'unreviewed');
    assert.equal(result.grid.children.length, 6);
});

test('late-loading reviews update ratings without losing the selected genre', async () => {
    const result = await run(initial, { reviewStatus: 'loading' });
    result.change('dealsGenre', 'Biography & memoir');
    result.setReviews([review(4, 5, 'a')]);
    assert.equal(result.nodes.dealsGenre.value, 'Biography & memoir');
    assert.equal(result.grid.children.length, 2);
    assert.equal(result.nodes.dealsSort.options.find(option => option.value === 'rating').disabled, false);
});

test('review outages leave genre browsing available without calling books unreviewed', async () => {
    const result = await run(initial, { reviewStatus: 'unavailable' });
    result.change('dealsGenre', 'Fiction');
    assert.equal(result.grid.children.length, 3);
    assert.equal(result.nodes.dealsRating.disabled, true);
    assert.match(result.grid.children[0].children[3].textContent, /unavailable/);
});

test('title sorting is alphabetical and expiry also hides filter controls', async () => {
    const result = await run(initial);
    result.change('dealsSort', 'title');
    assert.equal(titles(result)[0], 'My Sister’s Keeper');
    assert.equal(titles(result)[1], 'No One to Miss Me');
    result.setNow(Date.parse(initial.expiresAt));
    result.change('dealsGenre', 'Fiction');
    assert.equal(result.grid.children.length, 0);
    assert.equal(result.nodes.dealsControls.hidden, true);
});

test('expired selections disappear even if the feed expiry is extended', async () => {
    const { grid, status } = await run({ ...initial, expiresAt: '2027-01-01T00:00:00Z' }, {
        now: Date.parse('2026-10-02T07:39:00Z')
    });
    assert.equal(grid.children.length, 0);
    assert.match(status.textContent, /fresh check/);
});

test('an already-open page removes picks when their validity ends', async () => {
    const result = await run(initial);
    result.setNow(Date.parse(initial.expiresAt));
    result.timers.at(-1).callback();
    assert.equal(result.grid.children.length, 0);
});

test('future and malformed verification timestamps fail closed', async () => {
    for (const checkedAt of ['not-a-date', '2026-10-03T00:00:00Z']) {
        const { grid } = await run({ ...initial, checkedAt });
        assert.equal(grid.children.length, 0);
    }
});

test('unsafe and duplicate ASINs cannot create extra product links', async () => {
    const { grid } = await run({ ...initial, books: [
        initial.books[0], initial.books[0], { ...initial.books[1], asin: 'javascript:alert(1)' }
    ] });
    assert.equal(grid.children.length, 1);
});

test('book text is rendered literally, not interpreted as markup', async () => {
    const title = '<img src=x onerror=alert(1)>';
    const { grid } = await run({ ...initial, books: [{ ...initial.books[0], title }] });
    assert.equal(grid.children[0].children[1].textContent, title);
});

test('missing data and network failure preserve a useful fallback', async () => {
    for (const options of [{ data: null }, { data: initial, failed: true }, { data: { ...initial, books: [] } }]) {
        const { grid, status } = await run(options.data, options);
        assert.equal(grid.children.length, 0);
        assert.match(status.textContent, /Browse Amazon/);
    }
});
