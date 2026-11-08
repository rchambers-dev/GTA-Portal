import { redirect } from "next/navigation";

export default function ReviewAssistantRedirect() {
  redirect("/reviews/learners");
}
