import { livePropertyRuntime } from "@/domains/properties-live/runtime";

export async function GET() {
  return Response.json({ ok: true, capability: livePropertyRuntime.capability() });
}
