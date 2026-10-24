// Real Stripe Payment Links — hosted checkout pages, no API key or server
// action involved. Empty string means "not wired yet"; PurchaseButton
// renders an honest disabled/pending state rather than a dead or fake link
// until a real https://buy.stripe.com/... URL is dropped in here.
// The $12/month hub membership, with a 14-day free trial. Every
// "$12/month, 14-day free trial" button uses it. Paused: the Stripe link
// (buy.stripe.com/bJedR32wYcib6mig8g2wU0b) charged $24 up front with no
// trial. Put a link back only once its checkout page shows
// "14 days free, then $12.00 per month".
export const AIONE_PRO_SUBSCRIPTION_LINK = '';
export const DONATION_LINK = 'https://buy.stripe.com/00wcMY9S5fEM4mh2W87wA00';
export const STAR_TRACKER_LINK = 'https://buy.stripe.com/aFa00c9S50JS2e9gMY7wA03';
export const BUILDER_KIT_LINK = 'https://buy.stripe.com/9B64gsc0deAIdWR8gs7wA04';
export const HYDRONODE_PRO_LINK = 'https://buy.stripe.com/aFa8wI4xLbow3id1S47wA05';
export const AIONE_CORE_LINK = 'https://buy.stripe.com/bJedR2aW964cg4Z40c7wA06';
