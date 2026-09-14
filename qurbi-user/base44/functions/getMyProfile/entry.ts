import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUser = await base44.asServiceRole.entities.User.get(user.id);
    return Response.json({
      profile: {
        name: currentUser.display_name || currentUser.full_name || '',
        email: user.email || currentUser.email || '',
        phone: currentUser.phone || '',
      },
    });
  } catch (error) {
    console.error('getMyProfile error:', error.message);
    return Response.json({ error: 'Unable to load profile' }, { status: 500 });
  }
});
