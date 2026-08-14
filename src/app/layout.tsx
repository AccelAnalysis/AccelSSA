import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/app-shell";
import { PageAccessStates, resolveWorkspaceAccess } from "@/domains/identity-security/request-access";
import "./globals.css";

export const metadata: Metadata = {
  title: "AccelSSA",
  description: "Site Selection Decision Management Platform",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const access = await resolveWorkspaceAccess(cookieStore.toString());
  const account = access.state === PageAccessStates.ALLOW && access.tenant && access.email
    ? { email: access.email, tenantName: access.tenant.tenantName, role: access.tenant.role }
    : null;

  return (
    <html lang="en">
      <body>{account ? <AppShell account={account}>{children}</AppShell> : children}</body>
    </html>
  );
}
