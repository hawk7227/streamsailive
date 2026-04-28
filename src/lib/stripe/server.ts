/**
 * src/lib/stripe/server.ts
 *
 * Stripe is temporarily disabled.
 *
 * Purpose:
 * - Removes active Stripe client construction from the production build.
 * - Keeps stable exports so existing imports do not break immediately.
 * - Prevents the Stripe apiVersion TypeScript failure while billing is offline.
 *
 * Re-enable later by restoring the Stripe client with the Stripe package's
 * currently supported apiVersion.
 */

export function isStripeEnabled(): false {
  return false;
}

export function getStripe(): never {
  throw new Error(
    "Stripe is temporarily disabled. Billing routes should return a disabled response."
  );
}

export function requireStripe(): never {
  throw new Error(
    "Stripe is temporarily disabled. Billing routes should return a disabled response."
  );
}
