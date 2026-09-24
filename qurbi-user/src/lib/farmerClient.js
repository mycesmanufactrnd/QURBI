import { qurbiApi } from "@/api/qurbiClient";

// Farmer App — single source of truth for livestock data
// Calls a backend function that queries the Farmer App server-side

export async function loadLivestockWithFarmers() {
  const res = await qurbiApi.functions.invoke("fetchLivestock", {});
  return res.data.livestock;
}

export async function loadLivestockById(id) {
  const res = await qurbiApi.functions.invoke("fetchLivestock", { id });
  return res.data.livestock;
}

export async function loadBulkListings() {
  const res = await qurbiApi.functions.invoke("fetchBulkListings", {});
  return res.data.bulkListings || [];
}

export async function loadBulkListingById(id) {
  const res = await qurbiApi.functions.invoke("fetchBulkListings", { id });
  return res.data.bulkListings;
}
