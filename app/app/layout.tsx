import Nav from "@/components/Nav";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="paper-ui">
      {/* Handwriting and typewriter faces of the paper look; system fonts take over when offline. */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Courier+Prime:wght@400;700&display=swap" />
      <Nav user={user} area="app" />
      {children}
    </div>
  );
}
