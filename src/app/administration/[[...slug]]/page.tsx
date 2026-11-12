import { renderWorkspacePage } from "@/shell/workspaces/render-workspace-page";

type Props = {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  return renderWorkspacePage("administration", slug, await searchParams);
}
