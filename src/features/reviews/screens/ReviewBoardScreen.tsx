import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import { loadReviewBoard } from "../domain/review-board-repository";
import { ReviewBoardView } from "./ReviewBoardView";

export async function ReviewBoardScreen({
  workspace,
}: {
  workspace: "administration" | "management";
}) {
  const board = await loadReviewBoard();
  return (
    <ApprenticePageShell eyebrow="Reviews" title="Review board" hideHeader>
      {board.loadError ? <p role="alert">{board.loadError}</p> : null}
      <ReviewBoardView workspace={workspace} board={board} />
    </ApprenticePageShell>
  );
}
