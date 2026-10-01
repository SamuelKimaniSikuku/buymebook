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
        children: [], textContent: '', attributes: {},
        append(...children) { this.children.push(...children); },
        replaceChildren(...children) { this.children = children; },
        setAttribute(key, value) { this.attributes[key] = value; },
        set innerHTML(_) { throw new Error('Unsafe HTML insertion'); }
    };
}

async function run(data, { now = NOW, failed = false } = {}) {
    const grid = node();
    const status = node();
    const timers = [];
    let clock = now;
    const context = {
        document: {
            getElementById: id => ({ dealsGrid: grid, dealsStatus: status })[id],
            createElement: node,
            addEventListener() {}
        },
        window: { location: { hash: '' }, addEventListener() {} },
        Date: class extends Date { static now() { return clock; } },
        Intl, AbortController,
        setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; },
        clearTimeout() {},
        fetch: async () => {
            if (failed) throw new Error('Offline');
            return { ok: true, json: async () => data };
        }
    };
    vm.runInNewContext(script, context);
    await new Promise(resolve => setImmediate(resolve));
    return { grid, status, timers, setNow: value => { clock = value; } };
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
