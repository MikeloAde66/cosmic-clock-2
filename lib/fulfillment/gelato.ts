// Gelato API client. Product/catalog endpoints live on
// product.gelatoapis.com; order endpoints live on order.gelatoapis.com —
// separate subdomains, both authenticated the same way via X-API-KEY.
const GELATO_PRODUCT_BASE_URL = 'https://product.gelatoapis.com/v3';
const GELATO_ORDER_BASE_URL = 'https://order.gelatoapis.com/v4';

function getGelatoHeaders(): HeadersInit {
  if (!process.env.GELATO_API_KEY) {
    throw new Error('GELATO_API_KEY is not configured.');
  }
  return {
    'X-API-KEY': process.env.GELATO_API_KEY,
    'Content-Type': 'application/json',
  };
}

export interface GelatoCatalog {
  catalogUid: string;
  title: string;
}

// Read-only — safe to call any time, including just to verify the API key
// authenticates, since it never creates or modifies anything.
export async function fetchGelatoCatalogs(): Promise<GelatoCatalog[]> {
  const res = await fetch(`${GELATO_PRODUCT_BASE_URL}/catalogs`, {
    headers: getGelatoHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Gelato catalog fetch failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export interface GelatoShippingAddress {
  companyName?: string;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  state?: string;
  city: string;
  postCode: string;
  country: string; // ISO 3166-1 alpha-2
  email?: string;
  phone?: string;
}

export interface GelatoOrderItem {
  itemReferenceId: string;
  productUid: string;
  files: { type: string; url: string }[];
  quantity: number;
}

export interface GelatoOrderResult {
  id: string;
  orderReferenceId: string;
  fulfillmentStatus: string;
}

// Places a real print order — ships to a real address and bills the Gelato
// account on file. Only ever called from the Stripe webhook after a real
// customer payment completes, never during development/testing.
export async function createGelatoOrder(
  orderReferenceId: string,
  items: GelatoOrderItem[],
  shippingAddress: GelatoShippingAddress,
  currency: string = 'USD'
): Promise<GelatoOrderResult> {
  const res = await fetch(`${GELATO_ORDER_BASE_URL}/orders`, {
    method: 'POST',
    headers: getGelatoHeaders(),
    body: JSON.stringify({
      orderType: 'order',
      orderReferenceId,
      customerReferenceId: orderReferenceId,
      currency,
      items,
      shippingAddress,
    }),
  });
  if (!res.ok) {
    throw new Error(`Gelato order creation failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
