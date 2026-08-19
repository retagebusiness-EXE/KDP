import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { AppShell } from "@/components/nav/app-shell";
import { BookWizard } from "@/components/wizard/book-wizard";
import { getTemplate } from "@/lib/generation/templates";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { template: templateId } = await searchParams;
  const template = templateId ? getTemplate(templateId) : undefined;

  return (
    <AppShell user={user} activePath="/projects/new">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold text-slate-900">Create a Book</h1>
        <BookWizard template={template} />
      </div>
    </AppShell>
  );
}
