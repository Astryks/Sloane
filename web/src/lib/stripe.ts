import Stripe from "stripe";

let client: Stripe | null = null;

function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Server misconfiguration: STRIPE_SECRET_KEY is not set.");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

// Keep Stripe construction lazy so a production build can collect route
// metadata without requiring billing secrets in the build environment.
export const stripe = new Proxy({} as Stripe, {
  get(_target, property) {
    return Reflect.get(getStripe(), property);
  },
});
