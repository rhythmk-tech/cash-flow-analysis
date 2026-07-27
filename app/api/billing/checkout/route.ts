import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/session";
import { getStripeClient, getStripePriceId, isBillingEnabled } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

// Starts a Stripe Checkout session for the signed-in company's subscription. Dormant until
// STRIPE_SECRET_KEY and STRIPE_PRICE_ID are set — see lib/stripe.ts. No UI calls this yet.
export async function POST(req: Request) {
  if (!isBillingEnabled()) {
    return NextResponse.json({ error: "Billing isn't available yet." }, { status: 503 });
  }

  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Billing is a company-level concern tied to the owner's row, not something a team member
  // (even an admin) should be able to trigger on the owner's behalf.
  if (!session.isOwner) {
    return NextResponse.json({ error: "Only the account owner can manage billing." }, { status: 403 });
  }

  const stripe = getStripeClient();
  const priceId = getStripePriceId();
  if (!stripe || !priceId) {
    return NextResponse.json({ error: "Billing isn't available yet." }, { status: 503 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { stripeCustomerId: true },
  });
  if (!user) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.userEmail,
      metadata: { userId: session.userId },
    });
    customerId = customer.id;
    await prisma.user.update({ where: { id: session.userId }, data: { stripeCustomerId: customerId } });
  }

  const origin = new URL(req.url).origin;
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: session.userId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dashboard?billing=success`,
    cancel_url: `${origin}/dashboard?billing=cancelled`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
