import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const itemName = (order: any) => {
  const names = (order.items || []).map((item: any) =>
    item.listing_name || item.breed || item.animal || 'Livestock',
  ).filter(Boolean);
  return names.slice(0, 2).join(', ') || 'Livestock order';
};

const eventTime = (value: unknown, order: any) => {
  const candidate = typeof value === 'string' && value ? value : order.updated_date || order.created_date;
  const parsed = new Date(candidate || Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const ownerQuery = { $or: [{ buyer_id: user.id }, { created_by_id: user.id }] };
    const orders = await base44.asServiceRole.entities.Order.filter(ownerQuery, '-created_date', 200);
    const existing = await base44.asServiceRole.entities.Notification.filter(
      { buyer_id: user.id }, '-event_at', 500,
    );
    const existingKeys = new Set((existing || []).map((notification: any) => notification.event_key));
    const eventSignature = (notification: any) =>
      `${notification.order_id}:${notification.type}:${notification.title}:${notification.event_at}`;
    const existingSignatures = new Set((existing || []).map(eventSignature));
    const pending: any[] = [];

    for (const order of orders || []) {
      const name = itemName(order);
      const orderLabel = order.order_number || order.id;
      const tracking = order.tracking_photos || {};
      const hasStagedFarmerPhotos = ['before', 'during', 'after'].some(
        (stage) => tracking[stage]?.image_url,
      );

      for (const stage of ['before', 'during', 'after']) {
        const proof = tracking[stage];
        if (!proof?.image_url) continue;
        const occurredAt = eventTime(proof.uploaded_at, order);
        // The image URL is the stable upload identity. Status/date changes on
        // the order must not create a duplicate notification for this photo.
        const key = `${order.id}:farmer_photo:${stage}:${proof.image_url}`;
        const title = `Farmer uploaded ${stage} photo`;
        const signature = eventSignature({
          order_id: order.id,
          type: 'farmer_photo',
          title,
          event_at: occurredAt,
        });
        if (existingKeys.has(key) || existingSignatures.has(signature)) continue;
        existingKeys.add(key);
        existingSignatures.add(signature);
        pending.push({
          buyer_id: user.id,
          event_key: key,
          type: 'farmer_photo',
          title,
          message: `${name} · Order ${orderLabel}`,
          order_id: order.id,
          order_number: orderLabel,
          item_name: name,
          event_at: occurredAt,
          is_read: false,
        });
      }

      // Support older Farmer uploads that predate staged tracking photos.
      for (const [index, imageUrl] of (hasStagedFarmerPhotos ? [] : order.progress_images || []).entries()) {
        if (!imageUrl) continue;
        const occurredAt = eventTime(order.updated_date, order);
        const key = `${order.id}:farmer_photo:legacy:${index}:${imageUrl}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        pending.push({
          buyer_id: user.id,
          event_key: key,
          type: 'farmer_photo',
          title: 'Farmer uploaded a new photo',
          message: `${name} · Order ${orderLabel}`,
          order_id: order.id,
          order_number: orderLabel,
          item_name: name,
          event_at: occurredAt,
          is_read: false,
        });
      }

      const refundStatus = String(order.refund_status || '').toLowerCase();
      if (['approved', 'completed'].includes(refundStatus)) {
        const occurredAt = eventTime(order.refund_reviewed_at, order);
        const reviewIdentity = order.refund_reviewed_at || 'current';
        const key = `${order.id}:refund:approved:${reviewIdentity}`;
        const title = 'Your refund has been approved';
        const signature = eventSignature({
          order_id: order.id,
          type: 'refund_approved',
          title,
          event_at: occurredAt,
        });
        if (!existingKeys.has(key) && !existingSignatures.has(signature)) {
          existingKeys.add(key);
          existingSignatures.add(signature);
          pending.push({
            buyer_id: user.id,
            event_key: key,
            type: 'refund_approved',
            title,
            message: `${name} · Order ${orderLabel}`,
            order_id: order.id,
            order_number: orderLabel,
            item_name: name,
            event_at: occurredAt,
            is_read: false,
          });
        }
      } else if (refundStatus === 'rejected') {
        const occurredAt = eventTime(order.refund_reviewed_at, order);
        const reviewIdentity = order.refund_reviewed_at || 'current';
        const key = `${order.id}:refund:rejected:${reviewIdentity}`;
        const title = 'Your refund has been rejected';
        const signature = eventSignature({
          order_id: order.id,
          type: 'refund_rejected',
          title,
          event_at: occurredAt,
        });
        if (!existingKeys.has(key) && !existingSignatures.has(signature)) {
          existingKeys.add(key);
          existingSignatures.add(signature);
          pending.push({
            buyer_id: user.id,
            event_key: key,
            type: 'refund_rejected',
            title,
            message: `${name} · Order ${orderLabel}`,
            order_id: order.id,
            order_number: orderLabel,
            item_name: name,
            event_at: occurredAt,
            is_read: false,
          });
        }
      }
    }

    if (pending.length) {
      await Promise.all(pending.map((notification) =>
        base44.asServiceRole.entities.Notification.create(notification),
      ));
    }

    const notifications = pending.length
      ? await base44.asServiceRole.entities.Notification.filter({ buyer_id: user.id }, '-event_at', 500)
      : existing;
    return Response.json({
      notifications: (notifications || []).filter(
        (notification: any) => !notification.is_cleared,
      ),
    });
  } catch (error) {
    console.error('fetchMyNotifications error:', error.message);
    return Response.json({ error: 'Unable to load notifications' }, { status: 500 });
  }
});
