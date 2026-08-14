"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ProjectInfrastructureError,
  createClientAndProject,
  grantProjectAccessForMember,
  withProjectTransaction,
} from "@/domains/projects-workflow/runtime";
import { revokeProjectSecurityMembership } from "@/domains/projects-workflow/postgres";

function text(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  return value.trim() || undefined;
}
function required(formData: FormData, key: string): string {
  const value = text(formData, key);
  if (!value) throw new Error(`${key} is required`);
  return value;
}
function optionalNumber(formData: FormData, key: string): number | undefined {
  const value = text(formData, key);
  if (!value) return undefined;
  const parsed = Number(value.replaceAll(",", ""));
  if (!Number.isFinite(parsed)) throw new Error(`${key} must be a number`);
  return parsed;
}
function projectPath(projectId: string, state?: string): string {
  return `/projects/${encodeURIComponent(projectId)}${state ? `?state=${encodeURIComponent(state)}` : ""}`;
}
async function requestHeaders(): Promise<Headers> { return await headers(); }

async function finishProjectMutation(
  projectId: string,
  successState: string,
  failureState: string,
  operation: () => Promise<unknown>,
): Promise<never> {
  let state = successState;
  try {
    await operation();
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");
  } catch (error) {
    state = error instanceof ProjectInfrastructureError ? "infrastructure" : failureState;
  }
  redirect(projectPath(projectId, state));
}

export async function createClientProjectAction(formData: FormData): Promise<void> {
  let destination = "/projects/new?state=save-failed";
  try {
    const created = await createClientAndProject({
      clientLegalName: required(formData, "clientLegalName"),
      clientOperatingName: text(formData, "clientOperatingName"),
      industry: text(formData, "industry"),
      projectName: required(formData, "projectName"),
      facilityType: text(formData, "facilityType"),
      projectType: text(formData, "projectType"),
      targetGeographies: text(formData, "targetGeographies")?.split(",").map((item) => item.trim()).filter(Boolean),
      targetOpeningDate: text(formData, "targetOpeningDate"),
      capitalInvestment: optionalNumber(formData, "capitalInvestment"),
      plannedEmployment: optionalNumber(formData, "plannedEmployment"),
      averageWage: optionalNumber(formData, "averageWage"),
    }, await requestHeaders());
    revalidatePath("/projects");
    destination = projectPath(created.project.projectId, "created");
  } catch (error) {
    destination = error instanceof ProjectInfrastructureError ? "/projects/new?state=infrastructure" : "/projects/new?state=save-failed";
  }
  redirect(destination);
}

export async function updateProjectAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  return finishProjectMutation(projectId, "updated", "update-failed", async () => {
    await withProjectTransaction(({ actor, service }) => service.updateProject(actor, projectId, {
      name: required(formData, "name"), facilityType: text(formData, "facilityType"), projectType: text(formData, "projectType"),
      targetGeographies: text(formData, "targetGeographies")?.split(",").map((item) => item.trim()).filter(Boolean) ?? [],
      targetOpeningDate: text(formData, "targetOpeningDate"), capitalInvestment: optionalNumber(formData, "capitalInvestment"),
      plannedEmployment: optionalNumber(formData, "plannedEmployment"), averageWage: optionalNumber(formData, "averageWage"),
      engagementStatus: (text(formData, "engagementStatus") ?? "ACTIVE") as "DRAFT" | "ACTIVE" | "ON_HOLD" | "CLOSED" | "ARCHIVED",
    }, Number(required(formData, "expectedVersion"))), await requestHeaders());
  });
}

export async function transitionProjectStageAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  return finishProjectMutation(projectId, "stage-updated", "stage-failed", async () => {
    await withProjectTransaction(({ actor, service }) => service.transitionProjectStage(actor, projectId, required(formData, "toStageCode"), Number(required(formData, "expectedVersion")), text(formData, "reason")), await requestHeaders());
  });
}

export async function createProjectTaskAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  return finishProjectMutation(projectId, "task-created", "task-failed", async () => {
    await withProjectTransaction(({ actor, service }) => service.createTask(actor, projectId, {
      title: required(formData, "title"), description: text(formData, "description"),
      priority: (text(formData, "priority") ?? "MEDIUM") as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      assigneeId: text(formData, "assigneeId"), dueAt: text(formData, "dueAt") ? new Date(required(formData, "dueAt")).toISOString() : undefined,
      visibility: (text(formData, "visibility") ?? "INTERNAL") as "INTERNAL" | "PROJECT_TEAM" | "CLIENT" | "EXTERNAL_SHARED",
    }), await requestHeaders());
  });
}

export async function completeProjectTaskAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  return finishProjectMutation(projectId, "task-completed", "task-failed", async () => {
    await withProjectTransaction(({ actor, service }) => service.completeTask(actor, required(formData, "taskId"), Number(required(formData, "expectedVersion"))), await requestHeaders());
  });
}

export async function addProjectMemberAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  return finishProjectMutation(projectId, "member-added", "member-failed", async () => {
    const principalId = required(formData, "principalId");
    const projectRole = required(formData, "projectRole");
    const principalType = projectRole.startsWith("CLIENT_") ? "CLIENT_USER" : projectRole === "EXTERNAL_CONTRIBUTOR" ? "EXTERNAL_USER" : "TENANT_USER";
    await withProjectTransaction(async ({ actor, sql, service }) => {
      await service.addProjectMember(actor, projectId, { principalId, principalType, projectRole, activeImmediately: true });
      await grantProjectAccessForMember(sql, actor, projectId, principalId);
    }, await requestHeaders());
  });
}

export async function removeProjectMemberAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  return finishProjectMutation(projectId, "member-removed", "member-failed", async () => {
    const principalId = required(formData, "principalId");
    await withProjectTransaction(async ({ actor, sql, service }) => {
      if (principalId === actor.userId) throw new Error("The active project actor cannot remove their own access.");
      await service.removeProjectMember(actor, required(formData, "projectMemberId"), Number(required(formData, "expectedVersion")));
      await revokeProjectSecurityMembership(sql, actor.tenantId, projectId, principalId);
    }, await requestHeaders());
  });
}

export async function addProjectCommentAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  return finishProjectMutation(projectId, "comment-added", "comment-failed", async () => {
    await withProjectTransaction(({ actor, service }) => service.addComment(actor, projectId, {
      objectType: "PROJECT", objectId: projectId, body: required(formData, "body"),
      visibility: (text(formData, "visibility") ?? "INTERNAL") as "INTERNAL" | "PROJECT_TEAM" | "CLIENT" | "EXTERNAL_SHARED",
      mentions: formData.getAll("mentions").filter((value): value is string => typeof value === "string" && value.length > 0),
    }), await requestHeaders());
  });
}

export async function resolveProjectCommentAction(formData: FormData): Promise<never> {
  const projectId = required(formData, "projectId");
  return finishProjectMutation(projectId, "comment-resolved", "comment-failed", async () => {
    await withProjectTransaction(({ actor, service }) => service.resolveComment(actor, required(formData, "commentId"), Number(required(formData, "expectedVersion"))), await requestHeaders());
  });
}
