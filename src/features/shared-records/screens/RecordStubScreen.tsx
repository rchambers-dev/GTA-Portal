import { FeatureStubScreen } from "@/features/learner-lifecycle";

/** Thin shared record / queue shell — one mount per business object. */
export function RecordStubScreen({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return <FeatureStubScreen title={title} description={description} />;
}
