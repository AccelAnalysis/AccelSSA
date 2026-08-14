import { NextResponse } from "next/server";
import type { FinancialAnalysisRequest } from "@/domains/financial-analysis/contracts";
import { assertFinancialAnalysisReady } from "@/domains/financial-analysis/guard";
import { analyzeFinancialModels } from "@/domains/financial-analysis/service";
import { authorizeFinancialRequest, FinancialActions } from "@/domains/financial-analysis/access";
import { assertSameOrigin } from "@/domains/identity-security/request-access";
import { failure, success } from "@/platform/request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json(failure("CSRF_REJECTED", "Cross-origin financial analysis is not allowed."), { status: 403 });
  }

  try {
    const body = (await request.json()) as FinancialAnalysisRequest;
    const access = await authorizeFinancialRequest(request, body.projectId ?? "", FinancialActions.READ);
    if (!access.allowed || !access.scope) {
      return NextResponse.json(failure(access.code, access.reason), { status: access.status });
    }
    assertFinancialAnalysisReady(body);
    return NextResponse.json(success(analyzeFinancialModels(body, access.scope)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Financial analysis could not be calculated.";
    return NextResponse.json(failure("FINANCIAL_ANALYSIS_INVALID", message), { status: 400 });
  }
}
