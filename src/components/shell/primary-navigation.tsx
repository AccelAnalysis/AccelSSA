"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { primaryNavigation } from "@/platform/navigation";

export function PrimaryNavigation() {
  const pathname = usePathname();

  return (
    <nav className="nav-group" aria-label="Primary navigation">
      {primaryNavigation.map((item) => {
        const active = item.href === "/projects"
          ? pathname === "/" || pathname.startsWith("/projects")
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
