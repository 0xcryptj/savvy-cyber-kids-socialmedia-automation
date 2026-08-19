import "./globals.css";
import { SidebarNav } from "./components/SidebarNav";
import { AutoPipeline } from "./components/AutoPipeline";
import { ServerLifecycle } from "./components/ServerLifecycle";
import type { ReactNode } from "react";
import { getFeedHealth } from "@/src/ingest/wordpress";
import { getPipelineState } from "@/src/workspace/pipeline";

export const revalidate = 300;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const [feedHealth, pipeline] = await Promise.all([getFeedHealth(), getPipelineState()]);
  const feedsHealthy = feedHealth.blog && feedHealth.news;
  const pipelineText = pipeline.status === "RUNNING" ? "Pipeline running…" : pipeline.lastRunAt ? `Pipeline ran ${new Date(pipeline.lastRunAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Pipeline not run yet";
  return (
    <html lang="en">
      <body>
        <ServerLifecycle enabled={Boolean(process.env.SCK_SHUTDOWN_TOKEN)} />
        <AutoPipeline />
        <aside>
          <div className="brand">
            <img className="brand-logo" src="/branding/sck-logo-150.png" alt="Savvy Cyber Kids" />
            <span>savvy<br /><b>cyber kids</b></span>
          </div>
          <p className="eyebrow">SOCIAL CONTROL ROOM</p>
          <SidebarNav />
          <div className="sidebar-foot">
            <span className={`live-dot ${feedsHealthy ? "" : "live-dot-error"}`} /> {feedsHealthy ? "Live feeds connected" : "Feed issue — check Library"}
            <br /><small>{pipelineText}</small>
            <br /><small>Human review required</small>
          </div>
        </aside>
        <main>
          <header>
            <div>
              <p className="eyebrow">{today.toUpperCase()}</p>
              <h1>Savvy Cyber Kids social workspace</h1>
            </div>
            <div className="header-actions">
              <span className="safe-pill">● AUTO-PUBLISH OFF</span>
              <div className="avatar">SC</div>
            </div>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
