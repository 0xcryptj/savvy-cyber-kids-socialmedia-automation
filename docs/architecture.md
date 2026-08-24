# Architecture

The local Next.js application is the source of truth. Content flows from RSS or a manual URL into typed article records, then through validated generation and a pluggable renderer before entering `PENDING_REVIEW`. Human approval is required before `APPROVED`, `QUEUED`, `SCHEDULED`, or `PUBLISHED` states.

The domain is split into `ingest`, `content`, `design`, `workflow`, `integrations`, and `db`. Connectors are interfaces or small adapters so Postiz, Canva, and AI providers can be used without coupling UI components to vendor APIs. The current workspace uses file-backed persistence while SQLite/Drizzle remains the next persistence layer. The dashboard reads the Savvy Cyber Kids blog and news feed from a stored copy, then keeps generated packages locally for human review before scheduling through Postiz.

## Source updates are on demand

Both feeds belong to someone else's WordPress site, so the app does not poll
them. `storage/source-cache.json` holds the last known state of each feed, and
`listSourceArticles` reads from it. The network is touched in exactly two
cases: the cache has nothing to serve yet, or a human pressed **Update
sources**, which calls `POST /api/sources/refresh` and bypasses Next's fetch
cache so the result is genuinely current.

A refresh diffs incoming canonical URLs against the stored copy and records
what is new, which is what drives the "3 new articles found" note and the New
badges in the library. A cold cache reports nothing as new, so the first run
does not flag the entire feed. A failed refresh keeps the articles already
stored and records the reason against that feed rather than emptying the
library.
