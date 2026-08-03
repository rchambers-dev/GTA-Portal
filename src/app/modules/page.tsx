import { redirect } from "next/navigation";

/**
 * Old shared modules queue — Autocare delivery is now blocks + college tasks
 * under Programme delivery (tutor) / College tasks (apprentice).
 */
export default async function ModulesQueuePage() {
  redirect("/staff/programme-delivery");
}
