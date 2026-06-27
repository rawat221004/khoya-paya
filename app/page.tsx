import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "admin") redirect("/dashboard");
  if (user.role === "police") redirect("/police");
  redirect("/booth");
}
