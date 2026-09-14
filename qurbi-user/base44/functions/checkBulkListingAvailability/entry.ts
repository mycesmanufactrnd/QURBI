import { createClient } from 'npm:@base44/sdk@0.8.31';

const FARMER_APP_ID = '6a743cebbaaf44d2a9aea48a';
const FARMER_APP_API_KEY = Deno.env.get('FARMER_APP_API_KEY') || '44bc036a2ae04df7a44dbf7503e837e3';

Deno.serve(async (req) => {
  try {
    const { bulkListingIds } = await req.json().catch(() => ({}));
    const ids = [...new Set((Array.isArray(bulkListingIds) ? bulkListingIds : []).filter((id) => typeof id === 'string' && id))];
    if (!ids.length) return Response.json({ availability: {} });

    const farmerApi = createClient({ appId: FARMER_APP_ID, headers: { api_key: FARMER_APP_API_KEY } });
    const listings: any[] = await farmerApi.entities.BulkListing.list('-created_date', 200);
    const byId = new Map(listings.map((listing) => [listing.id, listing]));
    const availability = Object.fromEntries(ids.map((id) => {
      const listing = byId.get(id);
      if (!listing) return [id, { available: false, state: 'not_found' }];
      const available = listing.status === 'Available' && listing.marketplaceVisible === true;
      return [id, { available, state: available ? 'available' : 'unavailable', status: listing.status || '', marketplaceVisible: listing.marketplaceVisible === true }];
    }));
    return Response.json({ availability });
  } catch (error) {
    console.error('checkBulkListingAvailability error:', error.message);
    return Response.json({ error: 'Farmer bulk listing service is temporarily unavailable', code: 'farmer_api_error' }, { status: 502 });
  }
});
