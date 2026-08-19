# Make.com → SocialBee setup

This connects approved posts to SocialBee. You do not need to edit code.

1. Create a free [Make.com account](https://www.make.com/en/register).
2. Create a new scenario, choose **Import blueprint**, and select `docs/make-socialbee-blueprint.json` from this project.
3. Click the SocialBee module and connect/authorize your SocialBee account when Make asks.
4. Click the Webhook module, create/select the custom webhook, and copy its URL.
5. Open this app’s **Settings → Social posting handoff** and paste the URL into **Make.com Webhook URL**.
6. Set **Public App URL** to the real HTTPS address where this app is hosted. It must not be localhost: Make.com and SocialBee need to fetch the generated graphic.
7. Save the settings, click **Send test ping**, and confirm that it reports success.
8. Turn the Make.com scenario **ON**. Imported scenarios are off by default.

## Check the SocialBee mapping

Make renders SocialBee’s module field names and connection options live. Exact internal field IDs are not publicly documented, so open the SocialBee module after import and double-check/remap the fields. The webhook payload from this app contains `caption`, `hashtags`, `graphicUrl`, `mediaUrl`, `postId`, and `socialBeeWorkspaceId`. The blueprint intentionally marks the SocialBee mappings as placeholders rather than guessing undocumented IDs.

## Manual CSV fallback

If Make.com is not configured, open the app’s **Approved queue** and click **Export CSV for SocialBee**. Upload the downloaded CSV in SocialBee’s native CSV import screen. It contains `text`, `link`, and `imageUrls` columns for every approved post.
