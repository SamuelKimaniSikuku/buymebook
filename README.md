# Buy Me a Book

A lightweight community site for readers who cannot afford the books they need, built with African readers in mind.

**Live:** https://www.buymebook.com/buy-me-a-book.html

## Main journeys

- **Request a book:** a short moderated request form, with a persistent confirmation code after submission.
- **Give a book:** search open requests and follow the existing Amazon Kindle gift flow.
- **Read for free:** textbooks, classics, children’s stories, and audiobooks available without waiting for a donor.

The More menu retains receipt confirmation, gifted books, the request archive, recommendations, reading lists, reviews, and the project’s story. Navigation supports direct hash links and browser history.

## Files and hosting

- `buy-me-a-book.html` — accessible page structure and content.
- `site.css` — responsive layouts, system fonts, and reading themes.
- `site.js` — navigation, rendering, Supabase requests, and reader preferences.
- `index.html` — redirects the root URL to the main page.
- `CNAME` — the existing custom domain for GitHub Pages.

No build step or frontend framework is required. GitHub Pages serves the files from the existing repository configuration. To view locally, serve this directory with any static HTTP server (for example, `python3 -m http.server 8000`).

## Data and moderation

The frontend uses the existing Supabase REST API with its public anon key. Row Level Security and existing database policies remain the authority for access. New requests and reviews are submitted as `pending`; approve them in the Supabase dashboard.

Existing endpoints:

- `book_requests`: requests and their status.
- `book_reviews`: approved reviews and pending submissions.
- `rpc/mark_gifted`: records a donor’s gift confirmation.
- `rpc/confirm_received`: records receipt using the request ID and code.

Sample requests (`is_demo`) are excluded from public lists and totals. Successful empty responses stay empty. If loading fails, saved real requests can be shown with a clear stale-data notice; otherwise the interface offers retry. Request and gift success states appear only after a successful server response.

Do not put service-role keys in the frontend. Recipient email addresses are available to donors through the current public data model; this UI is not an access-control layer. Database privacy changes require separate backend work.

## Kindle country restrictions

Amazon requires a Kindle gift recipient to be in the same country as the giver. The site explains this before purchase but does not verify country eligibility. Confirm eligibility with the recipient before buying; do not promise worldwide Kindle gifting or automatic gift-card conversion.

[Amazon’s gifting rules](https://www.amazon.com/gp/help/customer/display.html?nodeId=GVWGP284MQ6ZRM59)

Free-reading resources provide another route to books without a donor or Kindle gift. Amazon affiliate links retain the tag `samuelkimanis-20`.

## Validation of the simplified interface

The redesign was checked with mocked DOM scenarios for navigation, search, sample filtering, moderation payloads, request success/failure, safe Amazon links, gift and receipt persistence, focus return, empty data, blocked storage, and offline cache. No real requests, gifts, or payments were created during these checks.

The older `GITHUB_SETUP_GUIDE.md` describes an earlier version; use the current files and Supabase setup above for this implementation.
