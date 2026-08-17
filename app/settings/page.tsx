import { designUrls, publishingUrls, sourceUrls } from "@/config/urls";

export default function Settings(){
  const openAiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const makeConfigured = Boolean(process.env.MAKE_WEBHOOK_URL);
  const autoPublish = process.env.AUTO_PUBLISH === "true";
  const rows = [
    ["RSS ingestion", "Ready", "Blog + news feed configured"],
    ["OpenAI", openAiConfigured ? "Connected" : "Pending", openAiConfigured ? `Captions use ${process.env.OPENAI_MODEL || "gpt-4o-mini"}` : "OPENAI_API_KEY not configured"],
    ["Source media", "Connected", "Uses the article’s blog or news-feed image"],
    ["Canva", "Configured", "4:5 branded template renderer ready"],
    ["Make.com", makeConfigured ? "Connected" : "Pending", makeConfigured ? "Webhook configured" : "MAKE_WEBHOOK_URL not configured"],
    ["SocialBee", "Planned", "Handled through Make.com"],
    ["Publishing", autoPublish ? "Enabled" : "Safe", autoPublish ? "AUTO_PUBLISH=true" : "AUTO_PUBLISH=false · approval required"]
  ];
  return <><div className="page-intro"><div><p className="eyebrow">WORKSPACE / CONFIGURATION</p><h2>Connector status</h2><p>Secrets are environment-only and never stored in the database.</p></div></div><div className="queue-list">{rows.map(([name,status,note])=><div className="card queue-row" key={name}><div><h3>{name}</h3><p>{note}</p></div><span className={status==="Ready"||status==="Safe"||status==="Configured"||status==="Connected"?"status":"count"}>{status}</span></div>)}</div><div className="card side-card section"><p className="eyebrow">REFERENCE LINKS</p><div className="quick-links"><a href={sourceUrls.blog} target="_blank" rel="noreferrer">Blog posts ↗</a><a href={sourceUrls.newsFeed} target="_blank" rel="noreferrer">News feed articles ↗</a><a href={designUrls.canvaTemplate} target="_blank" rel="noreferrer">Canva design template ↗</a><a href={publishingUrls.socialBee} target="_blank" rel="noreferrer">SocialBee ↗</a></div></div></>;
}
