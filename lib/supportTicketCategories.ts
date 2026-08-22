// Split out from lib/models/SupportTicket.ts so client components (like
// VaultSupportDrawer) can import the category list/type without pulling in
// Mongoose (a server-only package — Node's `tls` module, imported deep in
// its dependency chain, breaks the browser bundle if a client component
// imports the model file directly).
export const TICKET_CATEGORIES = ['Account & Sign-In', 'Vault Access', 'Radio / Studio Playback', 'Billing', 'Other'] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
