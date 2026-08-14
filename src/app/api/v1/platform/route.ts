import { platformDomains } from "@/platform/domains";
import { configurableRegistries } from "@/platform/admin";
import { success } from "@/platform/request";

export async function GET() {
  return Response.json(success({
    principle: "One project model, many analytical views.",
    domains: platformDomains,
    configurableRegistries,
    persistenceClasses: ["operational", "geospatial", "analytical", "objects", "search"],
    configurationPrecedence: ["PROJECT", "TEMPLATE", "TENANT", "PLATFORM"],
  }));
}
