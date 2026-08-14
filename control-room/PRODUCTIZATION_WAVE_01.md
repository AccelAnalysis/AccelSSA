# AccelSSA Productization Wave 01 — Control Room

Baseline main: `b48e6b02b6f52848874f689c20774c00b922678e`
Master issue: #21

## Mission
Converge the existing twelve domain implementations into a professional, work-oriented site-selection operating system without rewriting the platform or creating parallel sources of truth.

## Binding authority
`/AGENTS.md` remains binding. Preserve the tenant, project, candidate, metric, provenance, evidence, visibility, audit, version and decision contracts.

## Merge authority
Only the control-room/convergence lane merges to `main`. Category lanes open PRs and stop. Before every merge the control room must refetch current `main`, fetch the exact PR head, inspect changed files, verify ownership and conflicts, confirm exact-head tests and preserve newer valid implementation.

## Product acceptance
A visible action must work authoritatively, be intentionally disabled with a concise reason, or be removed. Placeholder-only work is not mergeable. Explanatory copy does not count as product completion. Do not fabricate external data, authentication state, integrations, credentials, project facts, property facts or metrics.

Use compact work surfaces: maps, tables, lists, tabs, split panes, drawers, editable fields, contextual commands and concise status. Avoid large explanatory paragraphs, repeated onboarding copy, descriptive-card grids, engineering terminology, fake activity and dead controls.

## Shared-file ownership
### Category 01 — exclusive shared-shell ownership
Category 01 owns shared product chrome and reusable interaction primitives:
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/components/shell/**`
- `src/components/ui/**`
- `src/platform/navigation.ts`
- shared layout/interaction primitives under `src/components/platform/**`
- shared request/persistence/job contracts under `src/platform/**` when not substantive domain logic
- root package/runtime configuration when required for shared runtime behavior

Other lanes must not independently redesign or replace the global shell, navigation, CSS architecture, generic data-table/tabs/drawer patterns, request envelope, audit primitives, job primitives or persistence contracts. If a lane needs a shared primitive, it should consume Category 01 work or make a narrowly coordinated change after refetching the Category 01 result.

### Category 02 — identity/security authority
Owns:
- `src/domains/identity-security/**`
- authentication/session/tenant adapters and protected-route enforcement
- Firebase Authentication provider integration if used
- authorization/visibility enforcement shared through existing Category 02 contracts
- auth-specific routes/components under `src/app/**` and `src/components/auth/**`

Must not create a second tenant model, visibility model or auth system.

### Category 03 — projects/clients/workflow authority
Owns:
- `domains/projects-workflow/**`
- `src/app/projects/**` except child subroutes explicitly owned below
- `src/components/projects/**`
- `src/components/workspace/projects-workspace.tsx`
- `src/app/contacts/**` and `src/components/contacts/**`
- authoritative project/client application adapters using shared persistence contracts
- selected-project context, overview, project-local navigation/layout and real project selection

Must not create a second project model.

### Category 04 — requirements/scenarios
Owns:
- `packages/requirements-engine/**`
- `src/app/projects/[projectId]/requirements/**`
- `src/components/requirements/**`
- requirement/scenario server actions or API endpoints

### Category 05 — GIS/spatial
Owns:
- `packages/gis/**`
- map/spatial components under `src/components/maps/**`
- `src/app/locations/**` for shared location/map workspace
- `src/app/projects/[projectId]/locations/**` and spatial-analysis child views

Must use the canonical candidate/project/geography contracts rather than create separate map records.

### Category 06 — market/workforce/infrastructure intelligence
Owns:
- `packages/location-intelligence/**`
- `src/app/projects/[projectId]/markets/**`
- `src/app/projects/[projectId]/workforce/**`
- `src/app/projects/[projectId]/infrastructure/**`
- `src/components/intelligence/**`

Must use canonical metrics/provenance and must preserve missing/unavailable values rather than converting them to zero.

### Category 07 — properties/sites/readiness
Owns:
- `packages/properties/**`
- `src/app/properties/**`
- `src/app/projects/[projectId]/properties/**`
- `src/components/properties/**`

Must use canonical project-candidate and evidence/provenance contracts.

### Category 08 — screening/scoring/comparison
Owns:
- `packages/decision-analytics/**`
- `src/app/analysis/**` for screening/scoring/comparison surfaces
- `src/app/projects/[projectId]/analysis/**`
- `src/components/analysis/**`

Qualification, score, risk, consultant judgment and client decision must remain separate.

### Category 09 — costs/incentives
Owns:
- `packages/financial-engine/**`
- `src/app/projects/[projectId]/costs/**`
- `src/app/projects/[projectId]/incentives/**`
- `src/components/financial/**`

Historical scenario/model versions must remain reproducible.

### Category 10 — due diligence/risk/candidate pipeline/site visits
Owns:
- `packages/domain-due-diligence/**`
- `src/app/visits/**`
- `src/app/projects/[projectId]/risks/**`
- `src/app/projects/[projectId]/shortlist/**`
- `src/app/projects/[projectId]/visits/**`
- `src/components/diligence/**`

Must use the shared candidate contract and must not overwrite scoring/qualification with risk status.

### Category 11 — evidence/recommendations/client deliverables
Owns:
- `packages/decision-output/**`
- `src/app/deliverables/**`
- `src/app/projects/[projectId]/recommendation/**`
- `src/app/projects/[projectId]/files/**`
- `src/components/deliverables/**`
- client-facing deliverable/presentation surfaces subject to Category 02 visibility enforcement

### Category 12 — integration/search/automation/operations/QA
Owns:
- `packages/data-ai-automation/**`
- integration/search/job/observability adapters
- operational health and background processing
- cross-domain integration tests and release QA
- production configuration required for external providers, without embedding credentials

Category 12 does not own the global shell, project model, candidate model, metric model or auth model. It may prepare adapters in parallel but final cross-domain wiring waits for upstream lane merge state.

## Persistence boundary
ADR-0002 remains accepted: PostgreSQL/PostGIS is the target authoritative transactional/geospatial store. The Firebase App Hosting deployment target does not by itself authorize replacing that data architecture with a competing Firestore model. Provider/vendor selection or connection configuration must preserve the shared persistence contracts.

## Parallel lane branches
Fresh lane branches are created only from the reconciled wave baseline after this control package is merged. Old pre-wave Category branches are historical references and are not valid heads for Wave 01.

Expected branch names:
- `wave01/category-01-shell-design-system`
- `wave01/category-02-identity-security`
- `wave01/category-03-projects-workflow`
- `wave01/category-04-requirements-scenarios`
- `wave01/category-05-gis-spatial`
- `wave01/category-06-location-intelligence`
- `wave01/category-07-properties-readiness`
- `wave01/category-08-decision-analytics`
- `wave01/category-09-financial-incentives`
- `wave01/category-10-diligence-risk-visits`
- `wave01/category-11-evidence-deliverables`
- `wave01/category-12-integration-ai-qa`

## PR acceptance record
Each lane PR must report:
1. base `main` SHA used;
2. exact PR head SHA;
3. files/routes owned and changed;
4. authoritative actions added or wired;
5. integrations/configuration required;
6. relevant tests and results;
7. user-facing acceptance evidence;
8. conflicts/dependencies on other lanes;
9. remaining real gaps;
10. explicit statement that it does not merge itself.

## Integration order
1. Category 01
2. Category 02
3. Category 03
4. Categories 04, 05, 06, 07
5. Categories 08, 09, 10
6. Category 11
7. Category 12
8. control-room cross-platform correction
9. complete `npm run check` on exact integrated head
10. exact-SHA Firebase App Hosting rollout and deployed smoke verification
