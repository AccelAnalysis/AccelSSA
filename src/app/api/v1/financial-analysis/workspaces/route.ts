import { NextResponse } from "next/server";
import type { FinancialWorkspaceSaveRequest } from "@/domains/financial-analysis/contracts";
import { authorizeFinancialRequest, FinancialActions } from "@/domains/financial-analysis/access";
import {
  FinancialDatabaseConfigurationError,
  getFinancialPersistenceStatus,
  loadFinancialWorkspace,
  saveFinancialWorkspaceVersion,
} from "@/domains/financial-analysis/persistence";
import { assertSameOrigin } from "@/domains/identity-security/request-access";
import { failure, success } from "@/platform/request";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim() ?? "";
  const scenarioId = url.searchParams.get("scenarioId")?.trim() ?? "";
  if (!projectId || !scenarioId) {
    return NextResponse.json(failure("FINANCIAL_CONTEXT_REQUIRED", "Project ID and scenario ID are required."), { status: 400 });
  }

  try {
    const access = await authorizeFinancialRequest(request, projectId, FinancialActions.READ);
    if (!access.allowed || !access.scope) {
      return NextResponse.json(failure(access.code, access.reason), { status: access.status });
    }
    return NextResponse.json(success(await loadFinancialWorkspace({ projectId, scenarioId }, access.scope)));
  } catch (error) {
    if (error instanceof FinancialDatabaseConfigurationError) {
      return NextResponse.json(
        failure(error.code, error.message, { retryable: false, details: { persistence: getFinancialPersistenceStatus() } }),
        { status: 503 },
      );
    }
    return NextResponse.json(failure("FINANCIAL_LOAD_FAILED", "Unable to load saved financial analysis."), { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json(failure("CSRF_REJECTED", "Cross-origin financial changes are not allowed."), { status: 403 });
  }

  try {
    const body = (await request.json()) as FinancialWorkspaceSaveRequest;
    const projectId = body.analysis?.projectId?.trim() ?? "";
    const access = await authorizeFinancialRequest(request, projectId, FinancialActions.EDIT);
    if (!access.allowed || !access.scope) {
      return NextResponse.json(failure(access.code, access.reason), { status: access.status });
    }
    return NextResponse.json(success(await saveFinancialWorkspaceVersion(body, access.scope)), { status: 201 });
  } catch (error) {
    if (error instanceof FinancialDatabaseConfigurationError) {
      return NextResponse.json(
        failure(error.code, error.message, { retryable: false, details: { persistence: getFinancialPersistenceStatus() } }),
        { status: 503 },
      );
    }
    if (error instanceof Error && !error.message.toLowerCase().includes("database")) {
      return NextResponse.json(failure("FINANCIAL_SAVE_INVALID", error.message), { status: 400 });
    }
    return NextResponse.json(failure("FINANCIAL_SAVE_FAILED", "Unable to save the financial version."), { status: 500 });
  }
}
