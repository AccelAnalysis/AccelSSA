import type {
  DecisionDependency,
  DecisionNodeRef,
  EvidenceLink,
  EvidenceRecord,
  EvidenceTargetType,
  Id,
} from "../types.js";

export interface EvidenceImpact {
  evidenceId: Id;
  impactedNodes: DecisionNodeRef[];
  recommendationIds: Id[];
}

function key(node: DecisionNodeRef): string {
  return `${node.type}:${node.id}`;
}

export class EvidenceGraph {
  private readonly evidence = new Map<Id, EvidenceRecord>();
  private readonly evidenceLinks: EvidenceLink[] = [];
  private readonly dependencies: DecisionDependency[] = [];

  constructor(
    evidence: readonly EvidenceRecord[] = [],
    evidenceLinks: readonly EvidenceLink[] = [],
    dependencies: readonly DecisionDependency[] = [],
  ) {
    for (const item of evidence) this.evidence.set(item.id, item);
    this.evidenceLinks.push(...evidenceLinks);
    this.dependencies.push(...dependencies);
  }

  addEvidence(record: EvidenceRecord): void {
    this.evidence.set(record.id, record);
  }

  addEvidenceLink(link: EvidenceLink): void {
    if (!this.evidence.has(link.evidenceId)) throw new Error(`Evidence ${link.evidenceId} is not registered`);
    this.evidenceLinks.push(link);
  }

  addDependency(link: DecisionDependency): void {
    this.dependencies.push(link);
  }

  supportingEvidence(targetType: EvidenceTargetType, targetId: Id): EvidenceRecord[] {
    const ids = new Set(
      this.evidenceLinks
        .filter(
          (link) =>
            link.targetType === targetType &&
            link.targetId === targetId &&
            (link.relationship === "SUPPORTS" || link.relationship === "VERIFIES"),
        )
        .map((link) => link.evidenceId),
    );
    return [...ids].map((id) => this.evidence.get(id)).filter((value): value is EvidenceRecord => Boolean(value));
  }

  contradictingEvidence(targetType: EvidenceTargetType, targetId: Id): EvidenceRecord[] {
    const ids = new Set(
      this.evidenceLinks
        .filter(
          (link) =>
            link.targetType === targetType && link.targetId === targetId && link.relationship === "CONTRADICTS",
        )
        .map((link) => link.evidenceId),
    );
    return [...ids].map((id) => this.evidence.get(id)).filter((value): value is EvidenceRecord => Boolean(value));
  }

  upstreamOf(node: DecisionNodeRef): DecisionNodeRef[] {
    return this.walk(node, "upstream");
  }

  downstreamOf(node: DecisionNodeRef): DecisionNodeRef[] {
    return this.walk(node, "downstream");
  }

  impactOfEvidence(evidenceId: Id): EvidenceImpact {
    if (!this.evidence.has(evidenceId)) throw new Error(`Evidence ${evidenceId} is not registered`);
    const start: DecisionNodeRef = { type: "EVIDENCE", id: evidenceId };
    const impactedNodes = this.downstreamOf(start);
    return {
      evidenceId,
      impactedNodes,
      recommendationIds: impactedNodes.filter((node) => node.type === "RECOMMENDATION").map((node) => node.id),
    };
  }

  private materializedEdges(): Array<{ from: DecisionNodeRef; to: DecisionNodeRef }> {
    const evidenceEdges = this.evidenceLinks.map((link) => ({
      from: { type: "EVIDENCE" as const, id: link.evidenceId },
      to: { type: link.targetType, id: link.targetId },
    }));
    const dependencyEdges = this.dependencies.map((link) => ({ from: link.from, to: link.to }));
    return [...evidenceEdges, ...dependencyEdges];
  }

  private walk(start: DecisionNodeRef, direction: "upstream" | "downstream"): DecisionNodeRef[] {
    const edges = this.materializedEdges();
    const queue: DecisionNodeRef[] = [start];
    const visited = new Set<string>([key(start)]);
    const result: DecisionNodeRef[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const next = edges
        .filter((edge) => (direction === "downstream" ? key(edge.from) === key(current) : key(edge.to) === key(current)))
        .map((edge) => (direction === "downstream" ? edge.to : edge.from));

      for (const node of next) {
        const nodeKey = key(node);
        if (visited.has(nodeKey)) continue;
        visited.add(nodeKey);
        result.push(node);
        queue.push(node);
      }
    }

    return result;
  }
}
