import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { InviteUserForm } from "@/components/auth/invite-user-form";
import { PageHeader } from "@/components/ui/page-header";
import { listTenantMembers } from "@/domains/identity-security/postgres";
import { firstFirmAdminTenant, PageAccessStates, resolveWorkspaceAccess } from "@/domains/identity-security/request-access";
import { Roles } from "@/domains/identity-security/types";

export default async function UsersAndRolesPage() {
  const cookieStore = await cookies();
  const access = await resolveWorkspaceAccess(cookieStore.toString());
  if (access.state !== PageAccessStates.ALLOW) redirect("/unauthorized");
  const adminTenant = firstFirmAdminTenant(access);
  if (!adminTenant) redirect("/unauthorized");
  const members = await listTenantMembers(adminTenant.tenantId);
  return (
    <>
      <PageHeader eyebrow="Administration" title="Users & roles" description="Manage organization membership. Firebase authenticates identities; AccelSSA tenant roles remain authoritative here." />
      <section className="section card">
        <h2>Invite or update member</h2>
        <InviteUserForm tenantId={adminTenant.tenantId} roles={Object.values(Roles)} />
      </section>
      <section className="section card">
        <h2>Members</h2>
        <div className="table-wrap">
          <table><thead><tr><th>Email</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>{members.map((member) => <tr key={member.userId}><td>{member.email}</td><td>{member.role.replaceAll("_", " ")}</td><td>{member.status}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
