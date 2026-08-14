import { FinancialAnalysisWorkspace } from "@/components/financial/financial-analysis-workspace";
import { PageHeader } from "@/components/ui/page-header";
import { getFinancialPersistenceStatus } from "@/domains/financial-analysis/persistence";

export default function FinancialAnalysisPage() {
  const persistence = getFinancialPersistenceStatus();

  return (
    <>
      <PageHeader
        eyebrow="Analysis · Financial"
        title="Costs, financial modeling & incentives"
        description="Build candidate operating-cost models, compare location economics, value incentives, and inspect every total back to its assumptions and sources."
        status="Calculations live"
      />
      <FinancialAnalysisWorkspace persistence={persistence} />
    </>
  );
}
