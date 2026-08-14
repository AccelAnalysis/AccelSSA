import type { DeliverableStatus } from "../types.js";

const allowed: Readonly<Record<DeliverableStatus, readonly DeliverableStatus[]>> = {
  DRAFT: ["GENERATING", "WITHDRAWN"],
  GENERATING: ["READY_FOR_REVIEW", "GENERATION_FAILED"],
  READY_FOR_REVIEW: ["GENERATING", "APPROVED", "WITHDRAWN"],
  APPROVED: ["PUBLISHED", "WITHDRAWN"],
  PUBLISHED: ["SUPERSEDED", "WITHDRAWN"],
  GENERATION_FAILED: ["GENERATING", "WITHDRAWN"],
  SUPERSEDED: [],
  WITHDRAWN: [],
};

export function assertDeliverableTransition(from: DeliverableStatus, to: DeliverableStatus): void {
  if (!allowed[from].includes(to)) throw new Error(`Invalid deliverable transition: ${from} -> ${to}`);
}
