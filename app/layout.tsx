import "./globals.css";
import { SidebarNav } from "./components/SidebarNav";
import { AutoPipeline } from "./components/AutoPipeline";
import { ServerLifecycle } from "./components/ServerLifecycle";
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
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
            <span className="live-dot" /> Live feeds connected
            <br />
            <small>Human review required</small>
          </div>
        </aside>
        <main>
          <header>
            <div>
              <p className="eyebrow">{today.toUpperCase()}</p>
              <h1>Good things worth sharing.</h1>
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
