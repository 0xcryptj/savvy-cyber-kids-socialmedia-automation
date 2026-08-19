import { designUrls, publishingUrls, sourceUrls } from "@/config/urls";
import { SettingsClient } from "./SettingsClient";
import { getEffectiveHandoffSettings } from "@/src/config/handoff-settings";

export default async function Settings(){
  const openAiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const handoffSettings = await getEffectiveHandoffSettings();
  const makeConfigured = Boolean(handoffSettings.makeWebhookUrl && handoffSettings.appPublicUrl);
  const autoPublish = process.env.AUTO_PUBLISH === "true";
  const rows = [
    ["RSS ingestion", "Ready", "Blog + news feed configured"],
    ["OpenAI", openAiConfigured ? "Connected" : "Pending", openAiConfigured ? `Captions use ${process.env.OPENAI_MODEL || "gpt-4o-mini"}` : "OPENAI_API_KEY not configured"],
    ["Source media", "Connected", "Uses the article’s blog or news-feed image"],
    ["Canva", "Configured", "4:5 branded template renderer ready"],
    ["Make.com", makeConfigured ? "Connected" : "Not configured", makeConfigured ? "Webhook and public app URL configured" : "Set up Social posting handoff below"],
    ["SocialBee", "Planned", "Handled through Make.com"],
    ["Publishing", autoPublish ? "Enabled" : "Safe", autoPublish ? "AUTO_PUBLISH=true" : "AUTO_PUBLISH=false · approval required"]
  ];
  return <SettingsClient rows={rows} links={[{ label: "Blog posts", href: sourceUrls.blog }, { label: "News feed articles", href: sourceUrls.newsFeed }, { label: "Canva design template", href: designUrls.canvaTemplate }, { label: "SocialBee", href: publishingUrls.socialBee }]} />;
}
