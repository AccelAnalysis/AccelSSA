import Link from "next/link";
import type { Key, ReactNode } from "react";

export function WorkspaceSurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`workspace-surface${className ? ` ${className}` : ""}`}>{children}</section>;
}

export function WorkspaceToolbar({
  children,
  trailing,
  ariaLabel = "Workspace tools",
}: {
  children?: ReactNode;
  trailing?: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <div className="workspace-toolbar" role="toolbar" aria-label={ariaLabel}>
      <div className="workspace-toolbar-group">{children}</div>
      {trailing ? <div className="workspace-toolbar-group">{trailing}</div> : null}
    </div>
  );
}

export function ProjectContextHeader({
  name,
  client,
  stage,
  metadata = [],
  actions,
}: {
  name: string;
  client?: string;
  stage?: string;
  metadata?: readonly { label: string; value: ReactNode }[];
  actions?: ReactNode;
}) {
  const items = [
    ...(client ? [{ label: "Client", value: client as ReactNode }] : []),
    ...(stage ? [{ label: "Stage", value: stage as ReactNode }] : []),
    ...metadata,
  ];

  return (
    <header className="project-context-header">
      <div className="project-context-title">
        <h1>{name}</h1>
        {items.length ? (
          <dl className="project-context-meta">
            {items.map((item) => (
              <div className="project-context-meta-item" key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}

export function SplitPane({
  primary,
  secondary,
  primaryLabel,
  secondaryLabel,
}: {
  primary: ReactNode;
  secondary: ReactNode;
  primaryLabel?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="split-pane">
      <section className="split-pane-primary">
        {primaryLabel ? <div className="pane-label">{primaryLabel}</div> : null}
        {primary}
      </section>
      <section className="split-pane-secondary">
        {secondaryLabel ? <div className="pane-label">{secondaryLabel}</div> : null}
        {secondary}
      </section>
    </div>
  );
}

export type DataTableColumn = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  width?: string;
};

export function DataTable({
  columns,
  rows,
  rowKey,
  emptyLabel = "No records",
  caption,
}: {
  columns: readonly DataTableColumn[];
  rows: readonly Record<string, ReactNode>[];
  rowKey?: (row: Record<string, ReactNode>, index: number) => Key;
  emptyLabel?: string;
  caption?: string;
}) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={column.align ? `cell-${column.align}` : undefined}
                style={column.width ? { width: column.width } : undefined}
                scope="col"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={rowKey ? rowKey(row, index) : index}>
              {columns.map((column) => (
                <td key={column.key} className={column.align ? `cell-${column.align}` : undefined}>
                  {row[column.key] ?? "—"}
                </td>
              ))}
            </tr>
          )) : (
            <tr>
              <td className="table-empty" colSpan={Math.max(columns.length, 1)}>{emptyLabel}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TabStrip({
  tabs,
  activeHref,
  ariaLabel = "Workspace sections",
}: {
  tabs: readonly { label: string; href: string; count?: number }[];
  activeHref: string;
  ariaLabel?: string;
}) {
  return (
    <nav className="tab-strip" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <Link
          className={`tab-link${tab.href === activeHref ? " active" : ""}`}
          aria-current={tab.href === activeHref ? "page" : undefined}
          href={tab.href}
          key={tab.href}
        >
          {tab.label}
          {typeof tab.count === "number" ? <span className="tab-count">{tab.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function FilterBar({ children, ariaLabel = "Filters" }: { children: ReactNode; ariaLabel?: string }) {
  return <div className="filter-bar" role="group" aria-label={ariaLabel}>{children}</div>;
}

export function SideDrawer({
  open = true,
  title,
  children,
  actions,
}: {
  open?: boolean;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  if (!open) return null;

  return (
    <aside className="side-drawer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="drawer-header"><h2>{title}</h2></div>
      <div className="drawer-body">{children}</div>
      {actions ? <div className="drawer-actions">{actions}</div> : null}
    </aside>
  );
}

export function InspectorPanel({
  title,
  meta,
  children,
  actions,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <aside className="inspector-panel" aria-label={title}>
      <div className="inspector-header">
        <div>
          <h2>{title}</h2>
          {meta ? <div className="inspector-meta">{meta}</div> : null}
        </div>
        {actions}
      </div>
      <div className="inspector-body">{children}</div>
    </aside>
  );
}

export function InlineStatus({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return <span className={`inline-status${tone === "neutral" ? "" : ` ${tone}`}`}>{children}</span>;
}

export function CompactMetricStrip({ metrics }: { metrics: readonly { label: string; value: ReactNode }[] }) {
  return (
    <div className="metric-strip" aria-label="Key metrics">
      {metrics.map((metric) => (
        <div className="metric-strip-item" key={metric.label}>
          <span className="metric-strip-value">{metric.value}</span>
          <span className="metric-strip-label">{metric.label}</span>
        </div>
      ))}
    </div>
  );
}

export function PageActionRow({ children }: { children: ReactNode }) {
  return <div className="page-action-row">{children}</div>;
}
