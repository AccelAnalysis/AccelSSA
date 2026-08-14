export type LineageNodeType =
  | "source_record"
  | "metric_observation"
  | "transformation"
  | "requirement"
  | "score_factor"
  | "score_category"
  | "candidate_result"
  | "cost_result"
  | "risk"
  | "finding"
  | "recommendation"
  | "deliverable";

export interface LineageNode {
  id: string;
  type: LineageNodeType;
  label: string;
  version?: string;
}

export interface LineageEdge {
  from: string;
  to: string;
  relationship: string;
}

export class LineageGraph {
  readonly #nodes = new Map<string, LineageNode>();
  readonly #outgoing = new Map<string, LineageEdge[]>();
  readonly #incoming = new Map<string, LineageEdge[]>();

  addNode(node: LineageNode): void {
    if (this.#nodes.has(node.id)) throw new Error(`Duplicate lineage node: ${node.id}`);
    this.#nodes.set(node.id, Object.freeze({ ...node }));
  }

  addEdge(edge: LineageEdge): void {
    if (!this.#nodes.has(edge.from) || !this.#nodes.has(edge.to)) {
      throw new Error("Lineage edges must reference existing nodes");
    }
    if (edge.from === edge.to || this.hasPath(edge.to, edge.from)) {
      throw new Error("Lineage graph must remain acyclic");
    }
    this.#outgoing.set(edge.from, [...(this.#outgoing.get(edge.from) ?? []), edge]);
    this.#incoming.set(edge.to, [...(this.#incoming.get(edge.to) ?? []), edge]);
  }

  ancestors(nodeId: string): LineageNode[] {
    return this.#walk(nodeId, this.#incoming, (edge) => edge.from);
  }

  descendants(nodeId: string): LineageNode[] {
    return this.#walk(nodeId, this.#outgoing, (edge) => edge.to);
  }

  hasPath(from: string, to: string): boolean {
    if (from === to) return true;
    const visited = new Set<string>();
    const stack = [from];
    while (stack.length) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const edge of this.#outgoing.get(current) ?? []) {
        if (edge.to === to) return true;
        stack.push(edge.to);
      }
    }
    return false;
  }

  #walk(
    start: string,
    edges: Map<string, LineageEdge[]>,
    next: (edge: LineageEdge) => string,
  ): LineageNode[] {
    if (!this.#nodes.has(start)) throw new Error(`Unknown lineage node: ${start}`);
    const result: LineageNode[] = [];
    const visited = new Set<string>([start]);
    const stack = [start];
    while (stack.length) {
      const current = stack.pop()!;
      for (const edge of edges.get(current) ?? []) {
        const id = next(edge);
        if (visited.has(id)) continue;
        visited.add(id);
        const node = this.#nodes.get(id)!;
        result.push(node);
        stack.push(id);
      }
    }
    return result;
  }
}
