import { renderWorkspacePage } from "@/shell/workspaces/render-workspace-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  return renderWorkspacePage("administration", slug, await searchParams);
}
