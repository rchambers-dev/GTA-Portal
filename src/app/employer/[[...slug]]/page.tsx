import { renderWorkspacePage } from "@/shell/workspaces/render-workspace-page";

type Props = {
  params: Promise<{ slug?: string[] }>;
};

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return renderWorkspacePage("employer", slug);
}
