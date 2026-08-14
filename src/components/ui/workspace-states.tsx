import type { ReactNode } from "react";

type StateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

function WorkspaceState({
  marker,
  tone,
  title,
  description,
  action,
}: StateProps & { marker: string; tone?: "error" | "configuration" }) {
  return (
    <section className={`workspace-state${tone ? ` ${tone}` : ""}`}>
      <div className="workspace-state-marker" aria-hidden="true">{marker}</div>
      <div className="workspace-state-copy">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="workspace-state-actions">{action}</div> : null}
    </section>
  );
}

export function EmptyState(props: StateProps) {
  return <WorkspaceState marker="—" {...props} />;
}

export function ErrorState(props: StateProps) {
  return <WorkspaceState marker="!" tone="error" {...props} />;
}

export function ConfigurationRequiredState(props: StateProps) {
  return <WorkspaceState marker="•" tone="configuration" {...props} />;
}

export function LoadingState({ label = "Loading", rows = 4 }: { label?: string; rows?: number }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div className="loading-label">{label}</div>
      {Array.from({ length: Math.max(1, rows) }, (_, index) => (
        <div className="skeleton-row" key={index} aria-hidden="true" />
      ))}
    </div>
  );
}
