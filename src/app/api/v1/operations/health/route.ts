import { operationalSnapshot } from "@/domains/data-ai/runtime-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = operationalSnapshot();
  const status = snapshot.readiness === "ERROR" ? 503 : 200;
  return Response.json(
    snapshot,
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
