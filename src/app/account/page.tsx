import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { PageAccessStates, resolveWorkspaceAccess } from "@/domains/identity-security/request-access";

export default async function AccountPage() {
  const cookieStore = await cookies();
  const access = await resolveWorkspaceAccess(cookieStore.toString());
  if (access.state !== PageAccessStates.ALLOW || !access.email) redirect("/auth/sign-in");
  return (
    <>
      <PageHeader eyebrow="Identity" title="Account" description="Your authenticated AccelSSA identity and organization access." />
      <section className="section card">
        <dl>
          <dt>Email</dt><dd>{access.email}</dd>
          <dt>Email verification</dt><dd>Verified</dd>
          <dt>Organization</dt><dd>{access.tenant?.tenantName}</dd>
          <dt>Role</dt><dd>{access.tenant?.role.replaceAll("_", " ")}</dd>
        </dl>
        <form action="/api/v1/auth/sign-out" method="post"><button className="button" type="submit">Sign out</button></form>
      </section>
    </>
  );
}
