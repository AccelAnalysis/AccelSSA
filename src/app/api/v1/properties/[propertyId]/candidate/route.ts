import type { PropertyCandidateAssociationInput } from "@/domains/properties-live/contracts";
import { livePropertyRuntime, propertyRuntimeErrorResponse } from "@/domains/properties-live/runtime";

export async function POST(request: Request, context: { params: Promise<{ propertyId: string }> }) {
  try {
    const { propertyId } = await context.params;
    const input = await request.json() as PropertyCandidateAssociationInput;
    const data = await livePropertyRuntime.associate(request, propertyId, input);
    return Response.json({ ok: true, data, capability: livePropertyRuntime.capability() }, { status: 201 });
  } catch (error) {
    return propertyRuntimeErrorResponse(error);
  }
}
