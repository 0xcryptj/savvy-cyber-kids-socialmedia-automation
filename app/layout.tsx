import "./globals.css";
import { Sidebar } from "./components/Sidebar";
import { AutoPipeline } from "./components/AutoPipeline";
import { ServerLifecycle } from "./components/ServerLifecycle";
import type { ReactNode } from "react";
import { getFeedHealth } from "@/src/ingest/wordpress";
import { getPipelineState } from "@/src/workspace/pipeline";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Savvy Cyber Kids social workspace",
  icons: {
    icon: "/branding/sck-logo-150.png",
    shortcut: "/branding/sck-logo-150.png",
    apple: "/branding/sck-logo-150.png"
  }
};

export const revalidate = 300;
// State is stored in the runtime Blob backend on Vercel; never snapshot it during build.
export const dynamic = "force-dynamic";

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
        <Sidebar feedsHealthy={feedsHealthy} pipelineText={pipelineText} />
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
