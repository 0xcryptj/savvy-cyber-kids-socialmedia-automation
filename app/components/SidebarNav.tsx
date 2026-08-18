"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, History, Home, Library, Settings2, Send } from "lucide-react";

const nav = [["/", "Home", Home], ["/library", "1. Choose content", Library], ["/review", "2. Review post", ClipboardCheck], ["/queue", "3. Ready to post", Send], ["/history", "Published history", History], ["/settings", "Settings", Settings2]] as const;

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav>
      {nav.map(([href, label, Icon]) => (
        <Link key={href} href={href} className={pathname === href ? "active" : undefined}>
          <span className="nav-icon"><Icon size={17} strokeWidth={1.8} aria-hidden="true" /></span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
