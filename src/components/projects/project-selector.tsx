"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function ProjectSelector() {
  const pathname = usePathname();
  const match = pathname.match(/^\/projects\/([^/]+)/);
  const projectId = match?.[1] && match[1] !== "new" ? match[1] : undefined;
  const [name, setName] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    setName(undefined);
    if (!projectId) return;
    fetch(`/api/v1/projects/${encodeURIComponent(projectId)}/context`, { credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => { if (!cancelled && payload?.name) setName(payload.name); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [projectId]);

  return (
    <Link className="context-item project-selector" href="/projects">
      <span className="context-label">Project</span>
      <span className="context-value">{projectId ? (name ?? "Loading…") : "Select"}</span>
    </Link>
  );
}
