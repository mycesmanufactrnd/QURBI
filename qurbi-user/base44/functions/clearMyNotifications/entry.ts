import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { notificationId, clearAll = false } = await req.json().catch(() => ({}));
    if (!clearAll && !notificationId) {
      return Response.json({ error: 'Notification ID is required' }, { status: 400 });
    }

    // Query ownership first. A caller-provided ID can never select another
    // buyer's notification.
    const owned = await base44.asServiceRole.entities.Notification.filter(
      { buyer_id: user.id }, '-event_at', 500,
    );
    const targets = clearAll
      ? (owned || []).filter((notification: any) => !notification.is_cleared)
      : (owned || []).filter(
          (notification: any) =>
            notification.id === notificationId && !notification.is_cleared,
        );

    if (!clearAll && !targets.length) {
      return Response.json({ error: 'Notification not found' }, { status: 404 });
    }

    const clearedAt = new Date().toISOString();
    await Promise.all(
      targets.map((notification: any) =>
        base44.asServiceRole.entities.Notification.update(notification.id, {
          is_cleared: true,
          cleared_at: clearedAt,
        }),
      ),
    );

    return Response.json({
      cleared_ids: targets.map((notification: any) => notification.id),
      cleared_count: targets.length,
    });
  } catch (error) {
    console.error('clearMyNotifications error:', error.message);
    return Response.json({ error: 'Unable to clear notifications' }, { status: 500 });
  }
});
