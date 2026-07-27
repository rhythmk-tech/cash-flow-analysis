import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/stripe";

// Stripe calls this to notify us when a subscription is created, changes, or ends. Dormant
// until STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set — see lib/stripe.ts. Point a Stripe
// webhook endpoint at /api/billing/webhook once billing goes live, listening for at least
// checkout.session.completed, customer.subscription.updated, and customer.subscription.deleted.

function idOf(value: string | { id: string } | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId = idOf(subscription.customer);
  if (!customerId) return;

  const item = subscription.items.data[0];
  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionPlan: item?.price.id ?? null,
      currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
    },
  });
}

export async function POST(req: Request) {
  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();
  if (!stripe || !webhookSecret) {
    // Billing isn't configured — there's no legitimate webhook to receive yet.
    return NextResponse.json({ error: "Billing isn't available yet." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[billing webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = idOf(checkoutSession.subscription);
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscription(subscription);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
