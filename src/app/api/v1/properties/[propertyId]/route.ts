import type { PropertyMutation } from "@/domains/properties-live/contracts";
import { livePropertyRuntime, propertyRuntimeErrorResponse } from "@/domains/properties-live/runtime";

export async function GET(request: Request, context: { params: Promise<{ propertyId: string }> }) {
  try {
    const { propertyId } = await context.params;
    const data = await livePropertyRuntime.get(request, propertyId);
    return Response.json({ ok: true, data, capability: livePropertyRuntime.capability() });
  } catch (error) {
    return propertyRuntimeErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ propertyId: string }> }) {
  try {
    const { propertyId } = await context.params;
    const mutation = await request.json() as PropertyMutation;
    const data = await livePropertyRuntime.mutate(request, propertyId, mutation);
    return Response.json({ ok: true, data, capability: livePropertyRuntime.capability() });
  } catch (error) {
    return propertyRuntimeErrorResponse(error);
  }
}
