import Nav from "@/components/Nav";
import { requireUser } from "@/lib/auth";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <Nav user={user} area={user.role === "admin" ? "admin" : "app"} />
      {children}
    </>
  );
}
