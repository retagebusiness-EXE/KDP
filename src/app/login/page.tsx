import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardBody } from "@/components/ui/card";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold text-white">K</div>
          <h1 className="text-xl font-semibold text-slate-900">Sign in to KDP Book Builder</h1>
          <p className="mt-1 text-sm text-slate-500">Plan, generate, and export original KDP books.</p>
        </div>
        <Card>
          <CardBody>
            <LoginForm />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
