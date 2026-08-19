import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/nav/app-shell";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const [userCount, projectCount, exportCount, jobsByStatus, costAgg, recentFailedJobs, recentExports, recentUsers] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.export.count(),
    prisma.generationJob.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.usageRecord.aggregate({ _sum: { estimatedCostCents: true, tokensInput: true, tokensOutput: true } }),
    prisma.generationJob.findMany({ where: { status: "FAILED" }, orderBy: { updatedAt: "desc" }, take: 10, include: { project: { select: { name: true } } } }),
    prisma.export.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { project: { select: { name: true } } } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, email: true, plan: true, role: true, createdAt: true } }),
  ]);

  const jobStatusMap = Object.fromEntries(jobsByStatus.map((j) => [j.status, j._count._all]));

  return (
    <AppShell user={user} activePath="/admin">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <h1 className="text-2xl font-semibold text-slate-900">Admin Dashboard</h1>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Users" value={userCount} />
          <StatCard label="Projects" value={projectCount} />
          <StatCard label="Exports" value={exportCount} />
          <StatCard label="Estimated AI cost" value={`$${((costAgg._sum.estimatedCostCents ?? 0) / 100).toFixed(2)}`} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>System health — generation jobs</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-3">
            {["QUEUED", "PROCESSING", "VALIDATING", "COMPLETED", "FAILED"].map((status) => (
              <Badge key={status} tone={status === "FAILED" ? "red" : status === "COMPLETED" ? "green" : "gray"}>
                {status}: {jobStatusMap[status] ?? 0}
              </Badge>
            ))}
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent errors</CardTitle>
            </CardHeader>
            <CardBody>
              {recentFailedJobs.length === 0 ? (
                <p className="text-sm text-slate-500">No recent errors.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {recentFailedJobs.map((j) => (
                    <li key={j.id} className="border-b border-slate-100 pb-2">
                      <p className="font-medium text-slate-800">{j.type} — {j.project.name}</p>
                      <p className="text-red-600">{j.error}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent exports</CardTitle>
            </CardHeader>
            <CardBody>
              {recentExports.length === 0 ? (
                <p className="text-sm text-slate-500">No exports yet.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {recentExports.map((e) => (
                    <li key={e.id} className="flex justify-between border-b border-slate-100 pb-2">
                      <span>{e.project.name} — {e.type}</span>
                      <span className="text-slate-400">{(e.fileSizeBytes / 1024).toFixed(0)} KB</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent users</CardTitle>
          </CardHeader>
          <CardBody>
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Plan</th>
                  <th className="pb-2">Role</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {recentUsers.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="py-1.5">{u.email}</td>
                    <td className="py-1.5">{u.plan}</td>
                    <td className="py-1.5">{u.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      </CardBody>
    </Card>
  );
}
