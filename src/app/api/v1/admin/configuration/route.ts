import { configurableRegistries } from "@/platform/admin";
import { failure, success } from "@/platform/request";

export async function GET() {
  return Response.json(success({ registries: configurableRegistries, mutationEnabled: false }));
}

export async function POST() {
  return Response.json(
    failure("AUTHORIZATION_NOT_ACTIVE", "Administrative configuration writes require Category 2 authenticated firm-administrator authorization."),
    { status: 501 },
  );
}
