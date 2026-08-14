import { success } from "@/platform/request";

export async function GET() {
  return Response.json(success({
    service: "accelssa",
    status: "ok",
    category1: "foundation-active",
    timestamp: new Date().toISOString(),
  }));
}
