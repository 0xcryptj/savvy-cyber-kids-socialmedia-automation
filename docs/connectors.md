# Connector setup

## Postiz

The approved queue is the local source of truth until a human schedules a package. Postiz then owns channel connections, calendar scheduling, and publishing.

1. Create a Postiz API key in Postiz developer settings.
2. Open this app’s **Settings → Publishing / Postiz**.
3. Save the API key and the default API URL (`https://api.postiz.com/public/v1` for Postiz Cloud).
4. Use **Test Postiz connection** to verify the key and see the number of connected channels.
5. Connect Instagram, Facebook, LinkedIn, X, or other channels inside Postiz.
6. Approve a post in this dashboard.
7. In **Ready to post**, select **Schedule in Postiz**, choose channels and a date/time, then confirm.

The dashboard uploads the rendered PNG directly to Postiz before creating the scheduled post. This avoids relying on Postiz being able to fetch a `localhost` URL during local development.

The integration uses the documented Postiz Public API:

- `GET /integrations` to discover connected channels, fetched once per batch.
- `POST /upload` to upload the generated graphic.
- `POST /posts` with `type: "schedule"` (or `"draft"`) to create one post covering every selected channel.

Scheduling and publishing belong to Postiz. This dashboard only guarantees the handoff.

### How the export path is kept safe

`src/integrations/postiz-client.ts` is the only place that talks to Postiz. It
classifies every failure (`auth`, `rate_limit`, `validation`, `timeout`, ...),
retries reads and uploads with jittered backoff, and honours `Retry-After`. It
deliberately never retries a create: Postiz has no idempotency key, so a blind
repeat is a duplicate on a real social account.

`src/integrations/postiz-ledger.ts` is the memory that makes export repeatable.
It stores, per post:

- a **content fingerprint** (caption, hashtags, graphic, adjustments) so an
  unchanged post is skipped and an edited one is sent again;
- the **Postiz post id for every channel**, so a partial batch resumes on only
  the channels that were missed;
- the **uploaded media id**, so a retry or a caption-only edit reuses the image
  already on Postiz instead of re-uploading it;
- a rolling count of create calls, checked against `POSTIZ_CREATE_BUDGET`.

A create that fails with a timeout or dropped connection is recorded as
`uncertain`: nobody can know whether Postiz accepted it, so the queue asks the
reviewer to check Postiz before re-sending rather than risking a duplicate.

### Preflight

`POST /api/postiz/preflight` runs every check the export would run, without
sending anything: caption length against each platform's limit, missing
captions or graphics, channels that disappeared from Postiz, content that
already went out, and the remaining hourly create budget. The approved queue
calls it as the selection changes, so problems appear in the dashboard rather
than as a 400 halfway through a batch.

Provider rules live in `src/integrations/postiz-providers.ts`, sourced from
`docs.postiz.com/public-api/providers/*`. Platforms whose payload this dashboard
cannot build - YouTube and TikTok need video, Pinterest needs a board, Reddit a
subreddit, Discord a channel id - are excluded in preflight with a reason.
Uncatalogued platforms stay permissive and post with a bare `__type`.

### Failure handling

A failed export leaves the post `APPROVED` and in **Ready to post**, with the
reason shown on the card. The reviewer's judgement still stands, the cause is
usually transient, and re-exporting is one click. Only successful exports move
on to `QUEUED` / `SCHEDULED`.

## AI and Canva

AI credentials are entered in Settings and stored locally with restricted file permissions. The local renderer remains deterministic and produces the branded 4:5 graphic that is uploaded to Postiz.
