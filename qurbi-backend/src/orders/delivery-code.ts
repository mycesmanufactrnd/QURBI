import { createHmac } from 'crypto';

// 6-digit handover code the buyer shows the courier. Derived from the
// assignment id with a server secret instead of stored, so it can neither
// leak from the database nor be guessed from the order number. The secret is
// read lazily so importing this file never requires the full app config.
export function deliveryCodeFor(assignmentId: string): string {
  const secret = process.env.DELIVERY_CODE_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET (or DELIVERY_CODE_SECRET) must be set');
  }
  const digest = createHmac('sha256', secret)
    .update(`delivery-code:${assignmentId}`)
    .digest();
  return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, '0');
}
