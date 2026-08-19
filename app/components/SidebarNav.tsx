"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, ClipboardCheck, Clock3, History, Home, Library, Settings2, Send } from "lucide-react";

const pipelineNav = [["/", "Home", Home], ["/library", "1. Choose content", Library], ["/review", "2. Review post", ClipboardCheck], ["/queue", "3. Ready to post", Send]] as const;
const workspaceNav = [["/history", "Published history", History], ["/scheduled", "Scheduled", Clock3], ["/failed", "Failed", AlertTriangle], ["/settings", "Settings", Settings2]] as const;

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav>
      {pipelineNav.map(([href, label, Icon]) => (
        <Link key={href} href={href} className={pathname === href ? "active" : undefined}>
          <span className="nav-icon"><Icon size={17} strokeWidth={1.8} aria-hidden="true" /></span>
          {label}
        </Link>
      ))}
      <p className="eyebrow nav-section-label">WORKSPACE</p>
      {workspaceNav.map(([href, label, Icon]) => (
        <Link key={href} href={href} className={pathname === href ? "active" : undefined}>
          <span className="nav-icon"><Icon size={17} strokeWidth={1.8} aria-hidden="true" /></span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
