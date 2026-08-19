import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { RegisterForm } from "@/components/auth/register-form";
import { Card, CardBody } from "@/components/ui/card";

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold text-white">K</div>
          <h1 className="text-xl font-semibold text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Start with 2 free projects, no credit card required.</p>
        </div>
        <Card>
          <CardBody>
            <RegisterForm />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
