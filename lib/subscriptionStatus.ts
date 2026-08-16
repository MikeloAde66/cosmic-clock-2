export interface SubscriptionStatus {
  active: boolean;
  tier?: string;
  billingInterval?: string;
}

// Thin client-side wrapper around /api/subscription/status — shared by the
// landing page's redirect-if-subscribed check and the dashboard's own
// access guard, so both agree on exactly one source of truth.
export async function checkSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  try {
    const res = await fetch(`/api/subscription/status?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return { active: false };
    return await res.json();
  } catch {
    return { active: false };
  }
}
