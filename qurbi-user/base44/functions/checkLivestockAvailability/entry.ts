import { createClient } from 'npm:@base44/sdk@0.8.31';

const FARMER_APP_ID = '6a743cebbaaf44d2a9aea48a';
const FARMER_APP_API_KEY = '44bc036a2ae04df7a44dbf7503e837e3';
const unavailableStatuses = new Set(['sold', 'unavailable', 'out of stock', 'reserved']);
function livestockMarketplaceState(livestock: any) {
  if (!livestock) return { available: false, state: 'not_found' };
  if (livestock.disabled || unavailableStatuses.has(String(livestock.status || '').trim().toLowerCase())) return { available: false, state: 'unavailable' };
  return { available: true, state: 'available' };
}
Deno.serve(async (req) => {
  try {
    const { livestockIds } = await req.json().catch(() => ({}));
    const ids = [...new Set((Array.isArray(livestockIds) ? livestockIds : []).filter((id) => typeof id === 'string' && id))];
    if (!ids.length) return Response.json({ availability: {} });

    const farmerApi = createClient({ appId: FARMER_APP_ID, headers: { api_key: FARMER_APP_API_KEY } });
    // Match the proven fetchLivestock bridge: list the Farmer entity through
    // the read-only server-side client, then identify the exact Farmer ID.
    let livestockRecords: any[];
    try {
      livestockRecords = await farmerApi.entities.Livestock.list('-created_date', 200);
    } catch (error) {
      console.error('Farmer Livestock query failed:', error.message);
      return Response.json({ error: 'Farmer livestock service is temporarily unavailable', code: 'farmer_api_error' }, { status: 502 });
    }
    const byId = new Map(livestockRecords.map((livestock) => [livestock.id, livestock]));
    const results = ids.map((id) => {
      const livestock = byId.get(id);
      if (!livestock) return [id, { available: false, state: 'not_found' }];
      const marketplaceState = livestockMarketplaceState(livestock);
      return [id, {
        available: marketplaceState.available,
        state: marketplaceState.state,
        disabled: Boolean(livestock.disabled),
        status: livestock.status || '',
        price: livestock.price,
      }];
    });
    return Response.json({ availability: Object.fromEntries(results) });
  } catch (error) {
    console.error('checkLivestockAvailability error:', error.message);
    return Response.json({ error: 'Unable to check livestock availability' }, { status: 500 });
  }
});
