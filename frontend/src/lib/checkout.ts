export type CheckoutPricing = 'regular' | 'student';

let selectedPricing: CheckoutPricing = 'regular';

export function setCheckoutPricing(pricing: CheckoutPricing): void {
  selectedPricing = pricing;
}

export function getCheckoutPricing(): CheckoutPricing {
  return selectedPricing;
}

export function getCheckoutPriceLabel(pricing: CheckoutPricing): string {
  return pricing === 'student' ? '₱99 per month' : '₱149 per month';
}

export function getCheckoutPricingLabel(pricing: CheckoutPricing): string {
  return pricing === 'student' ? 'Student' : 'Regular';
}
