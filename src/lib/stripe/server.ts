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
