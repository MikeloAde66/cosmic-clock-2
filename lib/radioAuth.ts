// Gate for the n8n-facing radio automation endpoints (weights, ad swap,
// vault health) — separate from the human-facing Vault PIN since these are
// meant to be called unattended, server-to-server, and mutate real data.
// Callers send the secret as `x-radio-automation-secret`.
export function isAuthorizedAutomationRequest(request: Request): boolean {
  const secret = process.env.RADIO_AUTOMATION_SECRET;
  if (!secret) return false;
  return request.headers.get('x-radio-automation-secret') === secret;
}
