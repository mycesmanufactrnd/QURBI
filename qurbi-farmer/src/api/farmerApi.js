import apiClient from "@/api/apiClient";

async function data(request) {
  try {
    const response = await request;
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message;
    error.message = Array.isArray(message)
      ? message.join(". ")
      : message || error.message || "Unable to complete the request";
    throw error;
  }
}

export const farmerProfileApi = {
  findByUserId: (userId) => data(apiClient.get(`/farmer-profiles/by-user/${userId}`)),
  create: (profile) => data(apiClient.post("/farmer-profiles", profile)),
  update: (profileId, profile) => data(apiClient.patch(`/farmer-profiles/${profileId}`, profile)),
};

export const farmVerificationApi = {
  listMine: async (params = { page: 1, limit: 20 }) => {
    try {
      return await data(apiClient.get("/farm-verifications", { params }));
    } catch (error) {
      if (error.response?.status === 404) return { data: [], total: 0, page: 1, limit: params.limit || 20 };
      throw error;
    }
  },
  submit: (verification) => data(apiClient.post("/farm-verifications", verification)),
};

export function latestVerification(page) {
  return page?.data?.[0] || null;
}

export function verificationDocuments(verification) {
  return verification?.documents && typeof verification.documents === "object"
    ? verification.documents
    : {};
}
