import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const { name = '', phone = '', email } = await req.json();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (email !== undefined && email !== user.email) {
      return Response.json({ error: 'Email is managed by your sign-in account and cannot be changed here' }, { status: 400 });
    }

    const editableName = String(name).trim();
    if (!editableName) return Response.json({ error: 'Name is required' }, { status: 400 });

    // Base44 User custom fields are updated through the authenticated User API.
    // `full_name` is an immutable identity field, while `display_name` is the
    // declared editable field shared with Admin's User record.
    await base44.auth.updateMe({ display_name: editableName, phone: String(phone).trim() });
    const updatedUser = await base44.asServiceRole.entities.User.get(user.id);
    return Response.json({ profile: { name: updatedUser.display_name || updatedUser.full_name || '', email: user.email || updatedUser.email || '', phone: updatedUser.phone || '' } });
  } catch (error) {
    console.error('updateMyProfile error:', error.message);
    return Response.json({ error: 'Unable to save profile' }, { status: 500 });
  }
});
