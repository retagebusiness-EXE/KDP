"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import type { PlanId, PlanLimits } from "@/lib/limits/plans";

export function PlanPicker({ currentPlan, plans }: { currentPlan: string; plans: [PlanId, PlanLimits][] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function upgrade(plan: PlanId) {
    setLoading(plan);
    const res = await fetch("/api/billing/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    setLoading(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {plans.map(([id, limits]) => (
        <Card key={id} className={cn(currentPlan === id && "ring-2 ring-indigo-500")}>
          <CardBody className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{limits.label}</h3>
              {currentPlan === id && <span className="text-xs font-medium text-indigo-600">Current plan</span>}
            </div>
            <ul className="space-y-1 text-xs text-slate-600">
              <li>{limits.maxProjects} projects</li>
              <li>{limits.maxGenerationsPerMonth} AI generations / mo</li>
              <li>{limits.maxPdfExportsPerMonth} PDF exports / mo</li>
              {limits.bulkGeneration && <li>Bulk generation</li>}
              {limits.priorityGeneration && <li>Priority generation</li>}
              {limits.watermarkPreviews && <li>Watermarked previews</li>}
            </ul>
            <Button size="sm" variant={currentPlan === id ? "secondary" : "primary"} className="w-full" disabled={currentPlan === id || loading === id} onClick={() => upgrade(id)}>
              {loading === id ? "Switching..." : currentPlan === id ? "Current" : "Switch plan"}
            </Button>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
