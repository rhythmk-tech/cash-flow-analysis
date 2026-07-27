import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/session";
import { getStripeClient, isBillingEnabled } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

// Opens the Stripe-hosted billing portal (update card, cancel, view invoices) for a company
// that already has a Stripe customer. Dormant until billing is configured — see lib/stripe.ts.
export async function POST(req: Request) {
  if (!isBillingEnabled()) {
    return NextResponse.json({ error: "Billing isn't available yet." }, { status: 503 });
  }

  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isOwner) {
    return NextResponse.json({ error: "Only the account owner can manage billing." }, { status: 403 });
  }

  const stripe = getStripeClient();
  if (!stripe) return NextResponse.json({ error: "Billing isn't available yet." }, { status: 503 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { stripeCustomerId: true },
  });
  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account found for this company yet." }, { status: 404 });
  }

  const origin = new URL(req.url).origin;
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${origin}/dashboard`,
  });

  return NextResponse.json({ url: portalSession.url });
}
