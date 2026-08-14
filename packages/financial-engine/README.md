# @accelssa/financial-engine

Category 9 domain kernel for **Costs, Financial Modeling & Incentives**.

This package is intentionally persistence- and framework-agnostic. The platform API, database adapters, authorization middleware, UI, background jobs, and external data connectors can wrap the same deterministic domain rules without duplicating financial logic.

## Implemented capabilities

- project/candidate/scenario-scoped cost assumptions;
- one-time, recurring, variable, headcount-, volume-, capital-, tax-base-, and custom-resolved costs;
- independent annual escalation;
- configurable financial horizons;
- annual nominal and present-value cash flows;
- Year 1 / 5 / 10 / 20 / configured-horizon summaries when inside the model horizon;
- net nominal cost and net present value after incentives;
- cost-per-employee and cost-per-unit measures;
- explicit `INCOMPLETE` state for missing required inputs;
- incentive nominal, realizable, probability-adjusted, PV, and actual-received values;
- scheduled incentive benefits;
- structured eligibility rules with `UNKNOWN` rather than assumed eligibility;
- incentive lifecycle validation;
- append-only negotiation events;
- candidate financial ranking and baseline differentials;
- category-level variance explanation;
- assumption/incentive sensitivity cases;
- immutable content-hashed financial snapshots.

## Precision contract

External monetary inputs are decimal **dollar strings**, for example:

```ts
unitCost: "27.40"
nominalAmount: "6400000"
```

Rates, ratios, quantities, and probabilities are also decimal strings:

```ts
escalationRate: "0.035"
discountRate: "0.075"
probability: "0.90"
quantity: "42000000"
```

The engine parses these into exact rational values backed by `bigint`. Published monetary results are integer **cent strings**. This avoids making authoritative financial results depend on IEEE-754 binary floating-point behavior and keeps results JSON-safe.

## Missing-data contract

Required missing cost data never becomes zero. A required assumption with a missing quantity, rate, or amount produces:

```ts
{
  status: "INCOMPLETE",
  missingInputs: ["Water: unit cost is missing"]
}
```

Incomplete models may be inspected but cannot be ranked by `compareCandidateFinancials`.

## Incentive treatment

A financial model can choose how incentive benefits affect modeled net cost:

- `NONE`
- `NOMINAL`
- `REALIZABLE`
- `PROBABILITY_ADJUSTED` (default)

Regardless of treatment, `valueIncentive` preserves the separate valuation dimensions required by AccelSSA.

## Example

```ts
import { calculateFinancialModel } from "@accelssa/financial-engine";

const result = calculateFinancialModel({
  modelId: "costmod-1",
  tenantId: "tenant-1",
  projectId: "project-1",
  candidateId: "site-a",
  scenarioId: "expected",
  version: 1,
  currency: "USD",
  baseYear: 2028,
  horizonYears: 10,
  discountRate: "0.075",
  employeeCount: "220",
  assumptions: [
    {
      id: "labor-production",
      tenantId: "tenant-1",
      projectId: "project-1",
      candidateId: "site-a",
      scenarioId: "expected",
      category: "LABOR",
      behavior: "HEADCOUNT_DEPENDENT",
      label: "Loaded labor cost",
      unitCost: "61000",
      startsInYear: 0,
      escalationRate: "0.035",
      provenance: {
        sourceId: "wage-model-v3",
        sourceType: "CONSULTANT_ASSUMPTION",
        confidence: "HIGH"
      }
    }
  ],
  incentives: []
});
```

## Integration boundaries

The package assumes upstream domains provide authoritative IDs and approved data; it does not fetch or authorize them itself.

- Category 2: authorization, visibility, tenant isolation.
- Category 3: project/client ownership.
- Category 4: scenario and shared assumption definitions.
- Category 6: wage, utility, tax, transportation and market observations.
- Category 7: real-estate, construction/readiness and property values.
- Category 8: converts financial outputs into decision scores/sensitivity views.
- Category 10: consumes incentive and financial risks.
- Category 11: evidence and client-facing deliverables.
- Category 12: canonical metrics, refresh, jobs, APIs, AI tools, observability.

## Development

```bash
npm install
npm test
```

The package has no runtime dependencies.
