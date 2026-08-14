import { success } from "@/platform/request";
import { primaryNavigation } from "@/platform/navigation";

export async function GET() {
  return Response.json(success({
    product: "AccelSSA",
    purpose: "Site Selection Decision Management Platform",
    workspace: "projects",
    navigation: primaryNavigation.map(({ label, href }) => ({ label, href })),
  }));
}
