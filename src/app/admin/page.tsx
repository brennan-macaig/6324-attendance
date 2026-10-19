import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/authz";

export default async function AdminIndex() {
  await requirePageUser("mentor", "/admin");
  redirect("/admin/hours");
}
