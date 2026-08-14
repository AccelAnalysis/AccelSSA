# Category 11 — Evidence, Recommendations, Client Experience & Deliverables

## Purpose

Category 11 is AccelSSA's decision-evidence, client communication, and publication domain. It turns the authoritative outputs of Categories 4–10 into a defensible recommendation, a security-filtered client experience, and reproducible client deliverables.

It must never become a second scoring engine, cost model, risk register, property registry, or project database.

## Domain boundary

```text
Requirements / Markets / Properties / Scores / Costs / Incentives / Risks / Visits
                                  │
                                  ▼
                         Decision Snapshot
                                  │
                   ┌──────────────┼──────────────┐
                   ▼              ▼              ▼
               Evidence     Recommendation   Client Projection
                   │              │              │
                   └──────────────┼──────────────┘
                                  ▼
                           Deliverable Engine
                                  │
                   ┌──────────────┼──────────────┐
                   ▼              ▼              ▼
                  PDF           PPTX          Data Room
```

## 1. Evidence and documents

A document is a logical record with immutable file versions. Evidence is a separate first-class assertion that can reference a document version, metric observation, client response, consultant assertion, or external reference.

Evidence links support the relationships:

- `SUPPORTS`
- `CONTRADICTS`
- `QUALIFIES`
- `SUPERSEDES`
- `VERIFIES`

Evidence can attach to requirements, metrics, property attributes, risks, cost assumptions, incentives, findings, scores, consultant judgments, recommendations, and recommendation conditions.

The separation matters because one source can support one conclusion while qualifying or contradicting another.

## 2. Decision graph

Category 11 exposes a graph over the relational project model. Upstream categories provide decision dependencies; Category 11 adds evidence edges and graph traversal.

Example:

```text
Evidence: utility letter
    → Property Attribute: 15 MW available
        → Finding: electrical capacity meets requirement
            → Consultant Judgment: utility delivery risk is low
                → Recommendation: prefer Site A
```

The graph supports two critical queries:

- **trace upstream** — why does this recommendation exist?
- **impact downstream** — what conclusions/recommendations may need review if this evidence changes?

## 3. Decision snapshots

A recommendation or deliverable must point to a `DecisionSnapshot`, not an uncontrolled collection of latest records.

A snapshot stores immutable references to the upstream versions used at that point, including as available:

- requirements version;
- scenario version;
- scorecard version;
- comparison version;
- cost-model version;
- incentive-model version;
- risk snapshot;
- candidate snapshot;
- site-visit snapshot.

This preserves the analytical state on which a client decision was based.

## 4. Recommendation lifecycle

Authoritative states are:

```text
DRAFT → INTERNAL_REVIEW → CLIENT_REVIEW → FINAL
```

Review states may return to draft/internal review for correction. `FINAL` is terminal. A later change creates a new recommendation version using `supersedesRecommendationId` rather than mutating the final record.

Recommendation candidate dispositions are deliberately independent of score/rank:

- `PREFERRED`
- `ALTERNATIVE`
- `CONDITIONAL`
- `NOT_RECOMMENDED`

This preserves the platform decision contract:

```text
qualification ≠ score ≠ risk ≠ consultant judgment ≠ client decision
```

## 5. Recommendation conditions

Conditions are structured records rather than prose only.

Examples:

- written confirmation of 15 MW electric capacity;
- completion of Phase I environmental review;
- incentive NPV above a defined threshold;
- wastewater expansion completed before the target opening window.

Condition states:

- `OPEN`
- `SATISFIED`
- `WAIVED`
- `FAILED`

Resolution can reference evidence.

## 6. Recommendation readiness

The package provides a structural readiness policy. It does not determine whether a professional recommendation is correct.

Blockers include unresolved mandatory requirements, open critical risks, and missing required evidence. Warnings include unapproved financial models, open high risks, incomplete final site visit, and open recommendation conditions.

The application layer may extend this policy with project-template-specific rules.

## 7. Client projection

The client portal is a filtered projection of authoritative project data.

The default Category 11 policy includes only items explicitly marked `CLIENT` or `EXTERNAL_SHARED`, and excludes `HIGHLY_RESTRICTED` content even if its visibility was misconfigured.

Nested content is evaluated independently. A client-visible candidate does not imply that internal notes, draft risks, negotiation positions, raw provider records, or consultant work product are visible.

Final authorization remains owned by Category 2. Category 11's policy is an additional publication boundary, not a replacement for server-side authorization.

## 8. Client participation

The model supports client questions and explicit decision acknowledgements. Client acknowledgements may record:

- `ACKNOWLEDGED`
- `APPROVED`
- `REJECTED`
- `REQUESTED_REVISION`

The acknowledgement references a specific recommendation version so later consultant revisions do not rewrite the decision record.

Client answers may later be materialized as evidence by the application adapter.

## 9. Deliverables

Logical deliverables include:

- Market Screening Report
- Market Comparison
- Labor Market Analysis
- Property Profile
- Site Comparison Matrix
- Site Visit Book
- Operating Cost Analysis
- Incentive Analysis
- Risk Report
- Executive Recommendation
- Board Presentation
- Client Data Room

A logical deliverable has immutable generated versions. Every version records:

- decision snapshot;
- template version;
- format;
- generating user;
- generated timestamp;
- storage object;
- checksum.

The renderer receives the frozen snapshot ID and template version. It must not silently switch to current project data during rendering.

## 10. Publication and export

The package models the deliverable lifecycle through draft, generation, review, approval, and publication states. The application layer should require the corresponding Category 2 export/publish permissions and emit audit/domain events for publication and client exposure.

Formats supported by the contract include PDF, PPTX, XLSX, ZIP, PNG, and JSON. HTML/client portal rendering can use the same projection model but is intentionally not treated as a downloadable file format in this domain.

## 11. Integration expectations

### Category 2 — Identity/Security

Provides authoritative tenant/project authorization and permission decisions.

### Category 3 — Projects/Clients

Provides project/client identity, membership, status, tasks/comments, and project lifecycle context.

### Category 4 — Requirements

Provides versioned requirement and scenario references for decision snapshots.

### Categories 5–7 — GIS/Markets/Properties

Provide authoritative source observations, candidate/property identities, maps, property evidence targets, and spatial outputs.

### Category 8 — Decision Analytics

Provides qualification, scores, comparisons, and historical analytical versions.

### Category 9 — Financial Modeling

Provides cost/incentive model versions and financial outputs.

### Category 10 — Due Diligence/Risk/Visits

Provides risk snapshots, site-readiness state, due-diligence findings, candidate history, and site-visit findings.

### Category 12 — Data/AI/Automation/Ops/QA

Consumes Category 11 events, exposes search/AI retrieval over permitted evidence/recommendations, performs rendering/background jobs, and supplies integration/e2e/security testing.

## 12. Security invariants

- authorization occurs server-side before reads/writes;
- tenant/project IDs come from authoritative context, not untrusted client ownership claims;
- cross-project evidence links are rejected;
- final recommendation records are immutable;
- client projection is allow-list based;
- highly restricted records are excluded from client projection;
- generated files inherit explicit classification/visibility from their logical deliverable;
- every client decision references an exact recommendation version;
- object storage URLs must be generated only after file-level authorization by the platform adapter.

## 13. Acceptance scenarios

1. Link a utility letter to a property attribute and trace its downstream recommendation impact.
2. Attach both supporting and contradicting evidence to the same finding without losing either source.
3. Create a recommendation from an explicit decision snapshot.
4. Prevent `DRAFT → FINAL` transition.
5. Prevent finalization when configured readiness blockers remain.
6. Prevent mutation of a final recommendation; require a superseding version.
7. Hide internal/highly-restricted nested records from the client projection.
8. Record a client acknowledgement against the exact recommendation version.
9. Generate a deliverable whose stored version preserves both snapshot and template version.
10. On render failure, leave an explicit `GENERATION_FAILED` state rather than a false successful artifact.
11. Reject cross-tenant/project evidence and snapshot references.
12. Emit domain events for evidence, recommendation, client decision, and deliverable milestones.
