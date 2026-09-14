import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Orders belong to the User app, but refund decisions must never be made
    // from a User-app session. In particular, a User-app `admin` role is not
    // evidence that the caller is an authenticated Farmer Admin. The Farmer
    // Admin workflow owns review, Stripe refund processing, and the final
    // refunded state; this endpoint intentionally has no write path.
    return Response.json({ error: 'Refund decisions can only be made by the Farmer Admin' }, { status: 403 });
  } catch (error) {
    console.error('reviewOrderRefund error:', error.message);
    return Response.json({ error: 'Unable to review the refund request' }, { status: 500 });
  }
});
