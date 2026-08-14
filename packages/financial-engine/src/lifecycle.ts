import type { IncentiveStateTransition, IncentiveStatus, ProjectIncentive } from "./types.js";

const ALLOWED_TRANSITIONS: Readonly<Record<IncentiveStatus, readonly IncentiveStatus[]>> = {
  IDENTIFIED: ["REQUESTED", "OFFERED", "EXPIRED"],
  REQUESTED: ["OFFERED", "NEGOTIATED", "EXPIRED"],
  OFFERED: ["NEGOTIATED", "APPROVED", "EXPIRED"],
  NEGOTIATED: ["APPROVED", "EXPIRED"],
  APPROVED: ["EARNED", "AT_RISK", "EXPIRED"],
  EARNED: ["RECEIVED", "AT_RISK"],
  RECEIVED: ["AT_RISK"],
  AT_RISK: ["APPROVED", "EARNED", "RECEIVED", "EXPIRED"],
  EXPIRED: [],
};

export function canTransitionIncentive(from: IncentiveStatus, to: IncentiveStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export interface TransitionCommand {
  to: IncentiveStatus;
  at: string;
  actorUserId: string;
  reason: string;
  evidenceIds?: string[];
}

export function transitionIncentive(incentive: ProjectIncentive, command: TransitionCommand): ProjectIncentive {
  if (!canTransitionIncentive(incentive.status, command.to)) {
    throw new Error(`Invalid incentive lifecycle transition ${incentive.status} -> ${command.to}`);
  }
  if (command.reason.trim().length === 0) throw new Error("Incentive transition reason is required");
  if (command.actorUserId.trim().length === 0) throw new Error("Incentive transition actor is required");
  if (Number.isNaN(Date.parse(command.at))) throw new Error("Incentive transition timestamp must be ISO-compatible");

  const transition: IncentiveStateTransition = {
    from: incentive.status,
    to: command.to,
    at: command.at,
    actorUserId: command.actorUserId,
    reason: command.reason,
    ...(command.evidenceIds === undefined ? {} : { evidenceIds: [...command.evidenceIds] }),
  };

  return {
    ...incentive,
    status: command.to,
    stateHistory: [...(incentive.stateHistory ?? []), transition],
  };
}
