"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { primaryNavigation } from "@/platform/navigation";

export function PrimaryNavigation() {
  const pathname = usePathname();
  return (
    <nav className="nav-group" aria-label="Primary navigation">
      <div className="nav-label">Workspace</div>
      {primaryNavigation.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={`nav-link${active ? " active" : ""}`}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
