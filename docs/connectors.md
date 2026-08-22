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

- `GET /integrations` to discover connected channels.
- `POST /upload` to upload the generated graphic.
- `POST /posts` with `type: "schedule"` to create one scheduled post for multiple integrations.

Provider-specific settings are kept minimal and use the channel identifier returned by Postiz. Instagram channels receive `post_type: "post"`; X receives `who_can_reply_post: "everyone"`; other providers use their documented `__type` identifier and can be expanded as platform-specific needs arise.

## AI and Canva

AI credentials are entered in Settings and stored locally with restricted file permissions. The local renderer remains deterministic and produces the branded 4:5 graphic that is uploaded to Postiz.
