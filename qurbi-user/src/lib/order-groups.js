const GROUP_PREFIX = "QURBI_CHECKOUT_GROUP:";

export function checkoutGroupNote(groupId) {
  return groupId ? `${GROUP_PREFIX}${groupId}` : undefined;
}

export function checkoutGroupFromOrder(order) {
  if (order?.checkout_group_id || order?.checkoutGroupId) {
    return order.checkout_group_id || order.checkoutGroupId;
  }
  const note = String(order?.buyerNotes || order?.buyer_notes || "");
  return note.startsWith(GROUP_PREFIX) ? note.slice(GROUP_PREFIX.length) : "";
}

export function combineOrders(orders = []) {
  const valid = orders.filter(Boolean);
  if (!valid.length) return null;
  const first = valid[0];
  const orderIds = valid.map((order) => order.id).filter(Boolean);
  const earliestExpiry = valid
    .map((order) => order.reservation_expires_at)
    .filter(Boolean)
    .sort()[0] || null;

  return {
    ...first,
    id: first.id,
    order_ids: orderIds,
    checkout_group_id: checkoutGroupFromOrder(first),
    order_number: valid.length === 1
      ? first.order_number
      : `${first.order_number} + ${valid.length - 1}`,
    items: valid.flatMap((order) => order.items || []),
    subtotal: valid.reduce((sum, order) => sum + Number(order.subtotal || 0), 0),
    delivery_fee: valid.reduce((sum, order) => sum + Number(order.delivery_fee || 0), 0),
    discount: valid.reduce((sum, order) => sum + Number(order.discount || 0), 0),
    total: valid.reduce((sum, order) => sum + Number(order.total || 0), 0),
    reservation_expires_at: earliestExpiry,
    reservation_status: valid.some((order) => order.reservation_status === "active")
      ? "active"
      : first.reservation_status,
    grouped_orders: valid,
  };
}

export function groupOrdersByCheckout(orders = []) {
  const grouped = new Map();
  orders.forEach((order) => {
    const groupId = checkoutGroupFromOrder(order);
    const key = groupId ? `checkout:${groupId}` : `order:${order.id}`;
    const current = grouped.get(key) || [];
    current.push(order);
    grouped.set(key, current);
  });
  return [...grouped.values()].map(combineOrders).filter(Boolean);
}

export function groupedOrderQuery(order) {
  const ids = order?.order_ids?.length ? order.order_ids : order?.id ? [order.id] : [];
  if (ids.length <= 1) return `order_id=${encodeURIComponent(ids[0] || "")}`;
  return `order_ids=${encodeURIComponent(ids.join(","))}`;
}

export function groupItemsByFarm(items = [], resolveProduct = (_item) => null) {
  const grouped = new Map();
  items.forEach((item, index) => {
    const product = resolveProduct(item);
    const farmName =
      item.farm_name ||
      item.farmName ||
      product?.farm_name ||
      product?.farmName ||
      item.farmer_name ||
      product?.farmer_name ||
      "Farm unavailable";
    const farmKey =
      item.farmer_id ||
      item.ownerId ||
      product?.ownerId ||
      `farm:${String(farmName).toLowerCase() || index}`;
    if (!grouped.has(farmKey)) {
      grouped.set(farmKey, { key: farmKey, name: farmName, items: [] });
    }
    grouped.get(farmKey).items.push(item);
  });
  return [...grouped.values()];
}
