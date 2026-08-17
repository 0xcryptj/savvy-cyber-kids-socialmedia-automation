import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

const nav = [["/", "Overview"], ["/review", "Pending review"], ["/queue", "Approved queue"], ["/scheduled", "Scheduled"], ["/history", "History"], ["/failed", "Failures"], ["/settings", "Settings"]];
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="en"><body><aside><div className="brand"><span className="brand-mark">✦</span><span>savvy<br /><b>cyber kids</b></span></div><p className="eyebrow">SOCIAL CONTROL ROOM</p><nav>{nav.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}</nav><div className="sidebar-foot"><span className="live-dot" /> Local workspace<br /><small>Human review required</small></div></aside><main><header><div><p className="eyebrow">WEDNESDAY · AUGUST 19, 2026</p><h1>Good things worth sharing.</h1></div><div className="header-actions"><span className="safe-pill">● AUTO-PUBLISH OFF</span><button className="icon-button">⌕</button><div className="avatar">SC</div></div></header>{children}</main></body></html> }
