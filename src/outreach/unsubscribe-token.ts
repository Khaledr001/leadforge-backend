import { createHmac } from 'node:crypto';

const SIG_LENGTH = 24;

/** Creates a signed, hard-to-guess unsubscribe token for a lead. */
export function createUnsubscribeToken(leadId: string, secret: string): string {
  const sig = sign(leadId, secret);
  return `${leadId}.${sig}`;
}

/** Verifies an unsubscribe token, returning the leadId or null if invalid. */
export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  const separator = token.indexOf('.');
  if (separator < 0) return null;

  const leadId = token.slice(0, separator);
  const sig = token.slice(separator + 1);
  const expected = sign(leadId, secret);

  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i += 1) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0 ? leadId : null;
}

function sign(leadId: string, secret: string): string {
  return createHmac('sha256', secret).update(leadId).digest('hex').slice(0, SIG_LENGTH);
}
