import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { withApiErrors } from "@/lib/api/respond";
import { getBillingProvider } from "@/lib/billing";

const schema = z.object({ plan: z.enum(["FREE", "CREATOR", "PRO"]) });

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    const session = await getBillingProvider().createCheckoutSession(user.id, body.plan);
    return NextResponse.json(session);
  });
}
