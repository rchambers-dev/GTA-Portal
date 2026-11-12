import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";

export function ReviewStubScreen({ title }: { title: string }) {
  return (
    <ApprenticePageShell
      eyebrow="Reviews"
      title={title}
      description="This page comes later. Plan is the screen that is ready."
    >
      <p>Nothing to do here yet.</p>
    </ApprenticePageShell>
  );
}
