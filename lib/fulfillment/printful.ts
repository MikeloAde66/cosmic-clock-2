// Printful API client — https://developers.printful.com/docs/
// Auth: Authorization: Bearer {token}. Account-level tokens additionally
// need X-PF-Store-Id on every request (store-level private tokens don't);
// set PRINTFUL_STORE_ID only if your token needs it.
const PRINTFUL_BASE_URL = 'https://api.printful.com';

function getPrintfulHeaders(): HeadersInit {
  if (!process.env.PRINTFUL_API_KEY) {
    throw new Error('PRINTFUL_API_KEY is not configured.');
  }
  const headers: HeadersInit = {
    Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
    'Content-Type': 'application/json',
  };
  if (process.env.PRINTFUL_STORE_ID) {
    headers['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID;
  }
  return headers;
}

export interface PrintfulSyncProduct {
  id: number;
  external_id: string;
  name: string;
  thumbnail_url: string;
  synced: number;
}

// Read-only — safe to call any time, including just to verify the API key
// authenticates, since it never creates or modifies anything.
export async function fetchPrintfulCatalog(): Promise<PrintfulSyncProduct[]> {
  const res = await fetch(`${PRINTFUL_BASE_URL}/store/products`, {
    headers: getPrintfulHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Printful catalog fetch failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.result;
}

export interface PrintfulRecipient {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state_code?: string;
  country_code: string;
  zip: string;
  email?: string;
  phone?: string;
}

export interface PrintfulOrderItem {
  variant_id: number;
  quantity: number;
  retail_price: string;
  files: { type: string; url: string }[];
}

export interface PrintfulOrderResult {
  id: number;
  status: string;
}

// Places a real order — ships to a real address and bills the Printful
// account on file. Only ever called from the Stripe webhook after a real
// customer payment completes, never during development/testing.
export async function createPrintfulOrder(
  recipient: PrintfulRecipient,
  items: PrintfulOrderItem[]
): Promise<PrintfulOrderResult> {
  const res = await fetch(`${PRINTFUL_BASE_URL}/orders`, {
    method: 'POST',
    headers: getPrintfulHeaders(),
    body: JSON.stringify({ recipient, items }),
  });
  if (!res.ok) {
    throw new Error(`Printful order creation failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { id: data.result.id, status: data.result.status };
}
