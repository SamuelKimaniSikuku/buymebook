# Curated Kindle deals

The Book Deals tab is available at `/buy-me-a-book.html#deals`. It uses the existing Amazon US affiliate tag, `samuelkimanis-20`, and works independently of the community database.

## Current source

The six initial titles were listed in **Kindle Monthly Deals** on [Amazon's Kindle deals page](https://www.amazon.com/amz-books/book-deals?filters=v1%3AFORMAT%5Bkindle_edition%5D) on 1 October 2026. Each product page was opened to confirm the author and Kindle ASIN. Descriptions are original editorial summaries. No Amazon cover images, reviews, ratings or product descriptions are copied into this feature.

The browser account used for checking was outside the US, so the product pages showed regional purchase restrictions. The shelf therefore identifies Amazon US and tells visitors to check eligibility and the final Kindle price themselves. It does not guarantee that these offers can be purchased or gifted from another region.

## Update the selection

1. Check the live Amazon US Kindle deals collection and the individual Kindle editions.
2. Edit `book-deals.json`: use the Kindle ASIN, title, author, a short category, and an original note. Avoid selecting ordinary recommendations, print editions, membership trials, or coming-soon offers as current Kindle deals.
3. Set `checkedAt` to the actual UTC verification time and `expiresAt` to no later than 24 hours afterwards (or an earlier known offer end).
4. Preview using `python3 -m http.server 8765 --bind 127.0.0.1` and open `http://127.0.0.1:8765/buy-me-a-book.html#deals`.
5. Publish through the repository's existing GitHub Pages process.

The browser hides the curated cards when the check is more than 24 hours old, when the expiry is reached, or when the timestamps are invalid. The link to Amazon's current deals remains available. Checks also run when a sleeping tab becomes visible again. Missing or malformed data leaves a useful fallback and does not affect the rest of the site. **No scheduled refresh is configured; the selection requires a new check and data update.**

## Adding live prices later

The curated version intentionally shows no numeric prices or discount percentages. [Amazon's Associates policies](https://affiliate-program.amazon.com/help/operating/policies) limit price and availability displays to Amazon-served content or data obtained through its approved APIs. For refreshed prices and savings, use [Amazon Creators API](https://affiliate-program.amazon.com/creatorsapi/docs/) with the site's approved Associates account. Keep credentials in a server-side secret store, never in this public repository or browser code. API access has separate eligibility requirements; having an affiliate tag alone does not establish API access.

Future integration must validate the Kindle edition, currency, reference-price basis, access restrictions and offer expiry, and follow Amazon's refresh, attribution and timestamp requirements. Do not populate prices from search snippets or compare Kindle prices against paperback list prices.
