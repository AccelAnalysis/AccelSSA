# Category 9 — Costs, Financial Modeling & Incentives

## Purpose

Category 9 is AccelSSA's authoritative location-economics domain. It converts project assumptions, candidate-specific operating conditions, taxes, real-estate economics, capital requirements, and incentive packages into comparable, explainable, versioned financial results.

It answers:

> What will this candidate actually cost over the selected horizon, what financial assistance is realistically available, when is that assistance realized, what conditions attach to it, and how sensitive is the conclusion to changed assumptions?

Category 9 does **not** own candidate scoring. It publishes financial facts/results that Category 8 may normalize into decision scores.

## Domain boundaries

```text
Category 4: project/scenario assumptions
             │
Category 6: wages, utilities, taxes, logistics
             │
Category 7: property, real estate, development costs
             ▼
┌──────────────────────────────────────────────┐
│ CATEGORY 9                                   │
│ Cost assumptions → cash flows → PV/NPV       │
│ Incentive programs → eligibility → valuation │
│ Negotiation → commitments → lifecycle        │
└──────────────────────────────────────────────┘
        │                 │                │
        ▼                 ▼                ▼
 Category 8          Category 10      Category 11
 Comparison          Risk             Evidence/reporting
```

Every project financial object must resolve to authoritative `tenantId`, `projectId`, `candidateId`, and where appropriate `scenarioId` and `version`.

## Implemented package

`packages/financial-engine` contains the framework-independent domain kernel.

The package intentionally has no database, web-framework, UI, or external-provider dependency. This allows the same financial rules to be called by HTTP APIs, background jobs, AI tools, report generation, and tests.

### Modules

```text
src/types.ts         shared Category 9 contracts
src/decimal.ts       exact decimal/rational financial arithmetic
src/model.ts         cost cash flows, horizons, PV, NPV, incomplete-state logic
src/incentives.ts    incentive validation, scheduled cash flow, valuation
src/eligibility.ts   rule-based eligibility evaluation
src/lifecycle.ts     incentive lifecycle state machine
src/negotiation.ts   append-only negotiation stream validation
src/comparison.ts    financial ranking, baseline differential, variance
src/sensitivity.ts   non-mutating scenario perturbation runs
src/versioning.ts    deterministic content-hashed snapshots
```

## Cost model contract

Supported business categories:

```text
LABOR
PAYROLL_BURDEN
REAL_ESTATE
CONSTRUCTION
ELECTRICITY
NATURAL_GAS
WATER
WASTEWATER
TELECOMMUNICATIONS
TRANSPORTATION
PROPERTY_TAX
SALES_USE_TAX
CORPORATE_TAX
INSURANCE
PERMITTING
OCCUPANCY
CUSTOM
```

Supported financial behaviors:

```text
ONE_TIME
RECURRING_FIXED
RECURRING_VARIABLE
HEADCOUNT_DEPENDENT
VOLUME_DEPENDENT
CAPITAL_DEPENDENT
TAX_BASE_DEPENDENT
CUSTOM_RESOLVED
```

The domain kernel treats `CUSTOM_RESOLVED` as an already-authorized/calculated dollar input. Formula configuration and expression execution, if later supported, should occur in a controlled service before values enter the core model rather than evaluating arbitrary expressions inside the financial engine.

## Precision and serialization

Authoritative money calculations must not rely on binary floating point.

Inputs use decimal strings. The engine parses them into exact rational values backed by `bigint`; output money is serialized as integer cent strings.

```text
Input dollars:      "4200000.25"
Input rate:         "0.035"
Output cents:       "420000025"
```

This makes model snapshots deterministic and JSON-safe while avoiding normal JavaScript money-rounding defects.

## Financial flow

```text
Observed data / project assumptions
            ↓
CostAssumption
            ↓
Resolve base amount
            ↓
Apply timing
            ↓
Apply annual escalation
            ↓
Annual nominal cash flow
            ↓
Discount to base year
            ↓
Annual present-value cash flow
            ↓
Horizon summaries
            ↓
Candidate financial comparison
```

## Missing information

Missing required information is a first-class state.

```text
Water volume: 500,000 GPD
Water rate:   UNKNOWN
```

must produce an `INCOMPLETE` financial model, not a water cost of `$0`.

Incomplete models:

- retain known cash flows;
- report `missingInputs`;
- remain inspectable;
- are prohibited from candidate ranking by the financial comparison service.

This prevents false precision and false cost advantages.

## Horizons

The model has a configurable integer `horizonYears`. It automatically returns summaries for Year 1, Year 5, Year 10, Year 20 when those horizons are inside the configured model, plus the configured horizon itself.

All calculations are generated from annual period cash flows rather than hardcoded separate five-/ten-/twenty-year formulas.

## Escalation

Recurring cost lines can define independent annual escalation rates.

```text
Labor          3.5%
Electricity    2.0%
Lease          2.5%
Water          3.0%
Insurance      4.0%
```

No hidden global inflation value is imposed by the engine. Shared escalation assumptions can be supplied through Category 4 scenario configuration and resolved into the candidate model.

## Present value

For annual cash flow `CF(t)` and discount rate `r`:

```text
PV(t) = CF(t) / (1 + r)^t
```

The discount rate is an explicit model input and therefore becomes part of the versioned financial state.

## Published financial measures

The engine publishes:

- nominal cost;
- present-value cost;
- nominal incentive value used by the selected model treatment;
- present-value incentive value;
- net nominal cost;
- net present value;
- cost per employee when employee count exists;
- cost per unit when production volume exists;
- candidate financial rank;
- baseline differential;
- category-level candidate variance.

## Shared and candidate-specific assumptions

The application layer should resolve assumption inheritance before calculation:

```text
Project default
      ↓
Scenario override
      ↓
Candidate override
      ↓
Resolved CostAssumption
```

The domain engine validates the resulting project/candidate/scenario scope but intentionally does not decide the inheritance policy. Category 4 owns project/scenario configuration.

## Incentive registry vs project incentive

The persistence/application layer should maintain two concepts:

### IncentiveProgram

Reusable jurisdiction/program definition:

- canonical program name;
- jurisdiction;
- authority;
- statutory/discretionary classification;
- eligibility rules;
- calculation method;
- deadlines;
- performance requirements;
- clawback terms;
- effective/expiration dates;
- source/evidence.

### ProjectIncentive

Candidate/project-specific opportunity or negotiated package:

- project;
- candidate;
- program;
- lifecycle state;
- nominal amount;
- estimated realizable amount;
- probability;
- benefit schedule;
- actual received amount;
- provenance/evidence;
- visibility.

## Incentive valuation

AccelSSA intentionally distinguishes:

```text
Nominal Value
Estimated Realizable Value
Probability-Adjusted Value
Present Value
Actual Received Value
```

A `$6.4M` advertised or offered package must never silently become `$6.4M` of economic value.

Example:

```text
Nominal                         $6,400,000
Estimated realizable            $4,700,000
Probability                     90%
Probability-adjusted             $4,230,000
Present value of benefit stream  $3,800,000
Actual received to date                 $0
```

The probability is an explicit consultant/project assumption; it is not invented by the engine.

## Incentive benefit timing

Each project incentive contains a schedule of `{yearIndex, share}` entries totaling exactly `1`.

This permits the model to represent benefits paid over multiple years and discount those benefits appropriately.

## Incentive treatment inside candidate economics

A financial model explicitly selects one treatment:

```text
NONE
NOMINAL
REALIZABLE
PROBABILITY_ADJUSTED
```

Default: `PROBABILITY_ADJUSTED`.

This choice controls how incentives reduce the financial model's net cost. The underlying valuation dimensions are still preserved separately.

## Eligibility engine

Program/application adapters can translate structured statutory/program rules into Category 9 eligibility rules.

Supported numeric operators:

```text
EQ
GT
GTE
LT
LTE
BETWEEN
```

Eligibility results:

```text
PASS
FAIL
CONDITIONAL
UNKNOWN
REQUIRES_AUTHORITY_CONFIRMATION
```

A missing project fact returns `UNKNOWN`. It is never converted into a pass.

Rules can explicitly require confirmation from the program authority even when project facts appear to meet the threshold.

## Incentive lifecycle

The implemented state machine recognizes:

```text
IDENTIFIED
REQUESTED
OFFERED
NEGOTIATED
APPROVED
EARNED
RECEIVED
AT_RISK
EXPIRED
```

Transitions require:

- actor;
- timestamp;
- reason;
- optional evidence.

History is appended to the incentive rather than silently replaced.

## Negotiation stream

Negotiation events support:

```text
ASK
OFFER
COUNTEROFFER
COMMITMENT
CONDITION
DEADLINE
NOTE
```

Each event is scope-checked against tenant/project/candidate/incentive and is appended by unique ID. Events retain amount, party, response deadline, evidence, actor, time and visibility where applicable.

The platform persistence layer should treat the negotiation stream as append-only for normal operations.

## Comparison

`compareCandidateFinancials()` requires:

- complete financial models;
- same tenant;
- same project;
- same scenario;
- same currency.

It ranks candidates by lowest net present value and publishes differential against an explicitly selected baseline candidate.

The comparison layer does **not** assign an AccelSSA decision score. Category 8 can consume net PV or other Category 9 measures and apply its own normalization/weighting rules.

## Variance explanation

`explainFinancialVariance()` aggregates present-value cash flow by financial category and identifies the contribution of each category to the candidate/baseline difference. Incentives are reported as a negative financial burden under `INCENTIVE`.

This supports explanations such as:

```text
Labor             +$11.4M
Electricity        -$2.8M
Real estate        +$0.9M
Transportation     -$3.2M
Taxes              +$2.7M
Incentives          -$2.1M
--------------------------------
Net difference      +$6.9M
```

## Sensitivity analysis

`runFinancialSensitivity()` performs non-mutating recalculation cases over an approved/base model. Cases can alter:

- discount rate;
- cost base amount;
- quantity;
- unit cost;
- escalation rate;
- incentive probability.

Each calculated case returns its change in net present value relative to the base model.

Future application services can build higher-level break-even analysis on top of this deterministic primitive.

## Version snapshots

Material financial decision states must survive later refreshes.

`createFinancialSnapshot()` creates a deterministic SHA-256 content hash over a canonicalized analytical payload plus explicit snapshot metadata.

Typical persisted milestones:

```text
Cost Model v1
Cost Model v2
Incentive Model v1
Financial Comparison v3
Finalist Financial Snapshot
Recommendation Financial Snapshot
```

The snapshot hash can be used to prove that the client-facing analytical payload has not silently changed.

## Recommended persistence model

When the platform persistence layer is implemented, Category 9 should map cleanly to entities resembling:

```text
financial_models
financial_model_versions
cost_assumptions
financial_cash_flows
financial_results
incentive_programs
project_incentives
incentive_eligibility_rules
incentive_eligibility_results
incentive_performance_requirements
incentive_state_transitions
negotiation_events
financial_snapshots
```

Every private table/entity must carry authoritative tenant ownership. Project/candidate foreign keys must be resolved server-side and authorization must not trust client-submitted tenant identity.

## Suggested service/API surface

```text
GET    /api/v1/projects/:projectId/cost-models
POST   /api/v1/projects/:projectId/cost-models
GET    /api/v1/projects/:projectId/cost-models/:modelId
PATCH  /api/v1/projects/:projectId/cost-models/:modelId
POST   /api/v1/projects/:projectId/cost-models/:modelId/calculate
GET    /api/v1/projects/:projectId/cost-models/:modelId/cash-flows
GET    /api/v1/projects/:projectId/cost-models/:modelId/results
POST   /api/v1/projects/:projectId/cost-models/:modelId/sensitivity
GET    /api/v1/projects/:projectId/financial-comparison

GET    /api/v1/incentive-programs
GET    /api/v1/projects/:projectId/incentives
POST   /api/v1/projects/:projectId/incentives
POST   /api/v1/projects/:projectId/incentives/:id/evaluate-eligibility
POST   /api/v1/projects/:projectId/incentives/:id/transition
GET    /api/v1/projects/:projectId/incentives/:id/valuation
GET    /api/v1/projects/:projectId/incentives/:id/negotiation
POST   /api/v1/projects/:projectId/incentives/:id/negotiation
```

These routes belong in the shared API/application layer once Category 1 establishes its conventions. Domain calculations should call this package rather than duplicate formulas inside route handlers.

## Domain events

The application/event layer should emit material events such as:

```text
CostAssumptionCreated
CostAssumptionChanged
FinancialModelCalculated
FinancialModelIncomplete
FinancialModelApproved
FinancialModelSuperseded
FinancialScenarioCalculated
IncentiveIdentified
IncentiveEligibilityEvaluated
IncentiveRequested
IncentiveOfferReceived
IncentiveNegotiated
IncentiveApproved
IncentiveEarned
IncentiveReceived
IncentiveMarkedAtRisk
IncentiveExpired
FinancialSnapshotCreated
```

Category 12 can use these events for refresh, notification, automation, audit and observability.

## UI contract

Project-level navigation should expose separate but linked **Costs** and **Incentives** workspaces.

### Costs

```text
Overview
Assumptions
Labor
Utilities
Real Estate
Construction
Transportation
Taxes
Other Costs
Cash Flow
Scenarios
Comparison
Sensitivity
```

### Incentives

```text
Opportunities
Eligibility
Requested
Offers
Negotiation
Approved
Performance
At Risk
Cash Flow
Comparison
```

Any headline financial number should drill down through:

```text
Result
→ Category
→ Cash flow
→ Assumption / incentive
→ Source + evidence
```

## Security and visibility

Category 2 owns authorization. Category 9 objects must be compatible with the platform visibility contract:

```text
INTERNAL
PROJECT_TEAM
CLIENT
EXTERNAL_SHARED
```

Negotiation data requires particular care. External economic-development contributors must never gain access to competing candidates' requests, offers, counteroffers, internal valuation, or consultant negotiation notes.

## Audit requirements

Material writes should retain:

- actor;
- timestamp;
- previous value/state;
- new value/state;
- reason where material;
- project;
- candidate;
- scenario/model version;
- evidence links.

The domain package preserves lifecycle history and version hashes; the shared audit service should record persistence/application actions.

## Testing contract

Category 9 requires deterministic unit coverage for:

- decimal parsing and rounding;
- recurring costs;
- one-time costs;
- variable costs;
- escalation;
- PV/NPV;
- horizon summaries;
- cost-per-employee/unit;
- missing-data behavior;
- incentive valuation;
- incentive schedules;
- eligibility;
- lifecycle transitions;
- negotiation scope;
- candidate ranking;
- baseline differential;
- variance explanation;
- sensitivity recalculation;
- snapshot determinism.

Cross-domain integration tests should later verify that authoritative Category 4/6/7 values flow into Category 9 and that Category 8/10/11 consume the resulting financial state without reimplementing financial logic.

## Completion principle

Category 9 is complete only when AccelSSA can answer, for any finalist:

- What does this candidate cost?
- Which inputs produced that answer?
- Which costs are location-sensitive?
- What is the 1/5/10/20-year or configured-horizon result?
- What is the present value?
- What is the difference against the selected baseline?
- Which assumptions materially change the result?
- Which incentives are potentially available?
- Which have actually been requested/offered/approved/earned/received?
- What portion is reasonably realizable?
- When are benefits expected?
- Which conditions and clawbacks apply?
- What financial data is still missing?
- What changed since the prior approved model?
- What source/evidence supports each material input?

The platform should therefore treat Category 9 as an auditable location-economics and incentives subsystem, not as a spreadsheet attachment.
