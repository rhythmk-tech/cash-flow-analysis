import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/session";
import AdminClient from "@/components/AdminClient";

export default async function AdminPage() {
  const admin = await requirePlatformAdmin();
  if (!admin) redirect("/dashboard");

  return <AdminClient adminEmail={admin.userEmail} />;
}
