"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createProject, createProjectTask, transitionProject } from "./runtime";

export interface ProjectActionState {
  ok: boolean;
  error?: string;
  projectId?: string;
}

function numberOrUndefined(value: FormDataEntryValue | null): number | undefined {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) throw new Error("Enter a valid number.");
  return parsed;
}

async function cookieHeader(): Promise<string | null> {
  return (await headers()).get("cookie");
}

export async function createProjectAction(_state: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  try {
    const project = await createProject(await cookieHeader(), {
      clientName: String(formData.get("clientName") ?? ""),
      projectName: String(formData.get("projectName") ?? ""),
      facilityType: String(formData.get("facilityType") ?? "").trim() || undefined,
      projectType: String(formData.get("projectType") ?? "").trim() || undefined,
      targetGeographies: String(formData.get("targetGeographies") ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      capitalInvestment: numberOrUndefined(formData.get("capitalInvestment")),
      plannedEmployment: numberOrUndefined(formData.get("plannedEmployment")),
      averageWage: numberOrUndefined(formData.get("averageWage")),
      targetOpeningDate: String(formData.get("targetOpeningDate") ?? "").trim() || undefined,
    });
    revalidatePath("/");
    revalidatePath("/projects");
    return { ok: true, projectId: project.projectId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Project could not be created." };
  }
}

export async function transitionProjectAction(_state: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  try {
    await transitionProject(
      await cookieHeader(),
      projectId,
      String(formData.get("toStageCode") ?? ""),
      Number(formData.get("expectedVersion")),
      String(formData.get("reason") ?? "").trim() || undefined,
    );
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");
    return { ok: true, projectId };
  } catch (error) {
    return { ok: false, projectId, error: error instanceof Error ? error.message : "Project stage could not be changed." };
  }
}

export async function createTaskAction(_state: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  try {
    await createProjectTask(await cookieHeader(), projectId, {
      title: String(formData.get("title") ?? ""),
      priority: String(formData.get("priority") ?? "MEDIUM") as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      dueAt: String(formData.get("dueAt") ?? "").trim() || undefined,
    });
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, projectId };
  } catch (error) {
    return { ok: false, projectId, error: error instanceof Error ? error.message : "Task could not be created." };
  }
}
