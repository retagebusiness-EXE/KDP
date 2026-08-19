import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { AppShell } from "@/components/nav/app-shell";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanPicker } from "@/components/settings/plan-picker";
import { PLAN_LIMITS, type PlanId } from "@/lib/limits/plans";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const plans = Object.entries(PLAN_LIMITS) as [PlanId, (typeof PLAN_LIMITS)[PlanId]][];

  return (
    <AppShell user={user} activePath="/settings">
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardBody className="text-sm text-slate-600">
            <p>
              <span className="text-slate-500">Name:</span> {user.name || "—"}
            </p>
            <p>
              <span className="text-slate-500">Email:</span> {user.email}
            </p>
            <p>
              <span className="text-slate-500">Role:</span> {user.role}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan &amp; billing</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="mb-4 text-xs text-slate-500">
              Billing is not yet connected to a real payment processor — switching plans here updates your account limits
              directly for development and demos.
            </p>
            <PlanPicker currentPlan={user.plan} plans={plans} />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
