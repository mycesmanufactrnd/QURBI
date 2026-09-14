import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { farmerName, farmName, state } = body;

    // Fetch all admin users (service role needed — User RLS blocks non-admins)
    const admins = await base44.asServiceRole.entities.User.filter({ role: "admin" });

    // Send email to each admin
    for (const admin of admins) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.email,
        subject: "New Farmer Verification — QURBI Farmer",
        body: `A new farmer has submitted their verification for review.\n\nName: ${farmerName}\nFarm: ${farmName}\nState: ${state}\n\nPlease log in to the admin dashboard to review the application.`,
      });
    }

    return Response.json({ notified: admins.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
