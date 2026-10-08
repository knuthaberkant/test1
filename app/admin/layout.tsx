import Nav from "@/components/Nav";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <>
      <Nav user={user} area="admin" />
      {children}
    </>
  );
}
