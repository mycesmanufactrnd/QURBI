import { createClient, createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const aisyah = createClient({
      appId: '6a22824084a6dd7fc49dba93',
      headers: { api_key: '44bc036a2ae04df7a44dbf7503e837e3' },
    });
    const [users, farmerAppAdmins] = await Promise.all([
      aisyah.entities.User.list('-created_date', 500),
      base44.asServiceRole.entities.User.filter({ role: 'admin' }),
    ]);
    const adminEmails = new Set(
      (farmerAppAdmins || [])
        .map((admin) => admin.email?.trim().toLowerCase())
        .filter(Boolean),
    );

    // Return only the fields the Farmer superadmin needs for the buyer directory.
    // Exclude administrators from both apps and do not expose the buyer app's
    // full custom User payload cross-app.
    const buyers = (users || [])
      .filter((buyer) => {
        const email = buyer.email?.trim().toLowerCase();
        const role = (buyer.data?.role || buyer.role || '').trim().toLowerCase();
        return Boolean(email) && role !== 'admin' && !adminEmails.has(email);
      })
      .map((buyer) => ({
        id: buyer.id,
        email: buyer.email,
        name: buyer.data?.name || buyer.name || buyer.full_name || "",
        full_name: buyer.full_name || "",
        created_date: buyer.created_date || "",
        firstSeenAt: buyer.data?.firstSeenAt || buyer.firstSeenAt || "",
      }));
    return Response.json({ users: buyers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
