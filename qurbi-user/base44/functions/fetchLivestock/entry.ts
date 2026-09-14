import { createClient } from 'npm:@base44/sdk@0.8.31';

const FARMER_APP_ID = "6a743cebbaaf44d2a9aea48a";
const FARMER_APP_API_KEY = "44bc036a2ae04df7a44dbf7503e837e3";
const unavailableStatuses = new Set(['sold', 'unavailable', 'out of stock', 'reserved']);
function isLivestockMarketplaceAvailable(livestock: any) {
  return Boolean(livestock) && !livestock.disabled && !unavailableStatuses.has(String(livestock.status || '').trim().toLowerCase());
}

function farmerDisplayName(user: any) {
  return user?.data?.name || user?.name || user?.full_name || 'Unknown Farmer';
}

function currentFarmLocation(livestock: any, profile: any) {
  const address = String(profile?.address || '').trim();
  const state = String(profile?.state || livestock?.state || livestock?.farmLocation || '').trim();

  if (!address) return state;
  if (!state || address.toLowerCase().includes(state.toLowerCase())) return address;
  return `${address}, ${state}`;
}

function enrichLivestock(livestock: any, user: any, profile: any) {
  return {
    ...livestock,
    farmer_name: farmerDisplayName(user),
    farm_name: profile?.farmName || '',
    farm_address: profile?.address || '',
    farm_state: profile?.state || livestock?.state || '',
    // Keep the existing buyer-side field name, but source it from the farmer's
    // current profile so profile edits appear without rewriting old listings.
    farmLocation: currentFarmLocation(livestock, profile),
  };
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));

    // The User app reads livestock from the separate Farmer app through this
    // server-side bridge. Keep the Farmer API key off the browser client.
    const farmerApi = createClient({
      appId: FARMER_APP_ID,
      headers: { api_key: FARMER_APP_API_KEY },
    });

    // Single livestock by ID (for detail page)
    if (body.id) {
      const livestock = await farmerApi.entities.Livestock.get(body.id);
      if (!isLivestockMarketplaceAvailable(livestock)) {
        return Response.json({ error: 'Livestock listing not found' }, { status: 404 });
      }
      let farmerUser = null;
      let farmerProfile = null;
      try {
        const ownerId = livestock.ownerId || livestock.created_by_id;
        const [users, profiles] = await Promise.all([
          farmerApi.entities.User.list("-created_date", 500),
          ownerId ? farmerApi.entities.FarmerProfile.filter({ userId: ownerId }, "-created_date", 1) : Promise.resolve([]),
        ]);
        farmerUser = users.find(u => u.id === ownerId) || null;
        farmerProfile = profiles?.[0] || null;
      } catch (e) {
        console.log("Farmer profile lookup unavailable for detail page:", e.message);
      }
      return Response.json({ livestock: enrichLivestock(livestock, farmerUser, farmerProfile) });
    }

    // All livestock (for browse page)
    const livestock = await farmerApi.entities.Livestock.list("-created_date", 200);

    // Farmer names — best-effort (User entity may require auth)
    let userMap = {};
    let profileMap = {};
    try {
      const users = await farmerApi.entities.User.list("-created_date", 500);
      userMap = Object.fromEntries(users.map(u => [u.id, u]));
    } catch (e) {
      console.log("User list unavailable, continuing without farmer names:", e.message);
    }

    try {
      const profiles = await farmerApi.entities.FarmerProfile.list("-created_date", 500);
      // Records are newest-first. Preserve the first profile if legacy duplicate
      // rows exist for a farmer.
      profileMap = Object.fromEntries(
        profiles.reduce((entries, profile) => {
          if (profile.userId && !entries.some(([userId]) => userId === profile.userId)) {
            entries.push([profile.userId, profile]);
          }
          return entries;
        }, []),
      );
    } catch (e) {
      console.log("Farmer profile list unavailable, continuing with listing locations:", e.message);
    }

    const result = livestock
      .filter(isLivestockMarketplaceAvailable)
      .map(l => {
        const ownerId = l.ownerId || l.created_by_id;
        return enrichLivestock(l, userMap[ownerId], profileMap[ownerId]);
      });

    return Response.json({ livestock: result });
  } catch (error) {
    console.error("fetchLivestock error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
