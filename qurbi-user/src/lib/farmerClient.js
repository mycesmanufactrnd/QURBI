import { base44 } from "@/api/base44Client";

// Farmer App — single source of truth for livestock data
// Calls a backend function that queries the Farmer App server-side

export async function loadLivestockWithFarmers() {
  const res = await base44.functions.invoke("fetchLivestock", {});
  return res.data.livestock;
}

export async function loadLivestockById(id) {
  const res = await base44.functions.invoke("fetchLivestock", { id });
  return res.data.livestock;
}

export async function loadBulkListings() {
  const res = await base44.functions.invoke("fetchBulkListings", {});
  return res.data.bulkListings || [];
}

export async function loadBulkListingById(id) {
  const res = await base44.functions.invoke("fetchBulkListings", { id });
  return res.data.bulkListings;
}
