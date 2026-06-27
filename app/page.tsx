import { redirect } from "next/navigation";
import { getCurrentPrincipal } from "@/lib/session";

export default async function Home() {
  const principal = await getCurrentPrincipal();
  if (!principal) redirect("/login");
  if (principal.role === "admin") redirect("/dashboard");
  if (principal.role === "police") redirect("/police");
  redirect("/booth");
}
