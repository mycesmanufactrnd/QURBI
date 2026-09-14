import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const { notificationId } = await req.json().catch(() => ({}));
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!notificationId) return Response.json({ error: 'Notification ID is required' }, { status: 400 });

    const owned = await base44.asServiceRole.entities.Notification.filter(
      { buyer_id: user.id }, '-event_at', 500,
    );
    const notification = (owned || []).find((candidate: any) => candidate.id === notificationId);
    if (!notification) return Response.json({ error: 'Notification not found' }, { status: 404 });

    const updated = notification.is_read
      ? notification
      : await base44.asServiceRole.entities.Notification.update(notification.id, { is_read: true });
    return Response.json({ notification: updated });
  } catch (error) {
    console.error('markMyNotificationRead error:', error.message);
    return Response.json({ error: 'Unable to update notification' }, { status: 500 });
  }
});
