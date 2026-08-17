"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  ["/", "Home"],
  ["/library", "1. Choose content"],
  ["/review", "2. Review post"],
  ["/queue", "3. Ready to post"],
  ["/settings", "Settings"]
] as const;

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav>
      {nav.map(([href, label]) => (
        <Link key={href} href={href} className={pathname === href ? "active" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
