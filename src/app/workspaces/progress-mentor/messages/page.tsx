import { MentorMessagesScreen } from "@/features/progress-mentor";
import { requireMentorWorkspace } from "@/shell/guards/mentor-workspace";

export default async function MentorMessagesPage() {
  await requireMentorWorkspace("/workspaces/progress-mentor/messages");
  return <MentorMessagesScreen />;
}
