import { createClient } from 'npm:@base44/sdk@0.8.31';

const FARMER_APP_ID = '6a743cebbaaf44d2a9aea48a';
const FARMER_APP_API_KEY = Deno.env.get('FARMER_APP_API_KEY') || '44bc036a2ae04df7a44dbf7503e837e3';

function isMarketplaceAvailable(listing: any) {
  return listing?.status === 'Available' && listing?.marketplaceVisible === true;
}

function farmerDisplayName(user: any) {
  return user?.data?.name || user?.name || user?.full_name || 'Unknown Farmer';
}

function currentFarmLocation(listing: any, profile: any) {
  const address = String(profile?.address || '').trim();
  const state = String(profile?.state || listing?.state || '').trim();

  if (!address) return state;
  if (!state || address.toLowerCase().includes(state.toLowerCase())) return address;
  return `${address}, ${state}`;
}

Deno.serve(async (req) => {
  try {
    const { id } = await req.json().catch(() => ({}));
    const farmerApi = createClient({ appId: FARMER_APP_ID, headers: { api_key: FARMER_APP_API_KEY } });
    const listings: any[] = await farmerApi.entities.BulkListing.list('-created_date', 200);
    const visible = listings.filter(isMarketplaceAvailable);
    const listing = id ? visible.find((candidate) => candidate.id === id) : null;

    if (id && !listing) return Response.json({ error: 'Bulk listing not found or unavailable' }, { status: 404 });

    let users: any[] = [];
    let profiles: any[] = [];
    try {
      users = await farmerApi.entities.User.list('-created_date', 500);
    } catch (error) {
      console.log('Farmer user lookup unavailable for bulk listings:', error.message);
    }
    try {
      profiles = await farmerApi.entities.FarmerProfile.list('-created_date', 500);
    } catch (error) {
      console.log('Farmer profile lookup unavailable for bulk listings:', error.message);
    }

    const userMap = Object.fromEntries(users.map((user) => [user.id, user]));
    const profileMap = Object.fromEntries(
      profiles.reduce((entries: any[], profile: any) => {
        if (profile.userId && !entries.some(([userId]) => userId === profile.userId)) {
          entries.push([profile.userId, profile]);
        }
        return entries;
      }, []),
    );

    const enrich = (candidate: any) => {
      const ownerId = candidate.ownerId || candidate.created_by_id;
      const user = userMap[ownerId];
      const profile = profileMap[ownerId];

      return ({
        id: candidate.id, ownerId: ownerId || '', name: candidate.name,
        images: candidate.images || [], videos: candidate.videos || [], coverImage: candidate.coverImage || '',
        maleCount: candidate.maleCount || 0, femaleCount: candidate.femaleCount || 0,
        breedBreakdown: candidate.breedBreakdown || [], state: candidate.state || '', totalPrice: candidate.totalPrice || 0,
        status: candidate.status, marketplaceVisible: candidate.marketplaceVisible === true, created_date: candidate.created_date,
        farmer_name: farmerDisplayName(user),
        farm_name: profile?.farmName || '',
        farm_address: profile?.address || '',
        farm_state: profile?.state || candidate.state || '',
        farm_location: currentFarmLocation(candidate, profile),
      });
    };

    return Response.json({ bulkListings: id ? enrich(listing) : visible.map(enrich) });
  } catch (error) {
    console.error('fetchBulkListings error:', error.message);
    return Response.json({ error: 'Unable to load bulk listings' }, { status: 502 });
  }
});
