/// <reference types="vite/client" />

import axios from "axios";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api").replace(/\/$/, "");

export const ACCESS_TOKEN_KEY = "qurbi_courier_access_token";
export const REFRESH_TOKEN_KEY = "qurbi_courier_refresh_token";
export const AUTH_EXPIRED_EVENT = "qurbi:auth-expired";

function readToken(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeToken(key, token) {
  try {
    if (token) localStorage.setItem(key, token);
    else localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

export const getAccessToken = () => readToken(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => readToken(REFRESH_TOKEN_KEY);

/** @param {{ accessToken?: string | null, refreshToken?: string | null }} [tokens] */
export function setSessionTokens({ accessToken, refreshToken } = {}) {
  writeToken(ACCESS_TOKEN_KEY, accessToken);
  writeToken(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearSessionTokens() {
  writeToken(ACCESS_TOKEN_KEY, null);
  writeToken(REFRESH_TOKEN_KEY, null);
}

function notifyAuthExpired() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  // Let the browser add the multipart boundary for file uploads.
  if (config.data instanceof FormData) delete config.headers["Content-Type"];
  return config;
});

let refreshRequest = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const refreshToken = getRefreshToken();
    const isAuthRequest = originalRequest?.url?.includes("/auth/login") || originalRequest?.url?.includes("/auth/refresh");

    if (error.response?.status !== 401 || isAuthRequest) return Promise.reject(error);

    if (originalRequest?._retry || !refreshToken) {
      clearSessionTokens();
      notifyAuthExpired();
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      refreshRequest ||= axios
        .post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
        .then(({ data }) => {
          setSessionTokens(data);
          return data.accessToken;
        })
        .finally(() => { refreshRequest = null; });

      const accessToken = await refreshRequest;
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      clearSessionTokens();
      notifyAuthExpired();
      return Promise.reject(refreshError);
    }
  },
);

function errorMessage(error) {
  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join(". ");
  return message || error.message || "Unable to complete the request";
}

async function unwrap(request) {
  try {
    const response = await request;
    return response.data;
  } catch (error) {
    error.message = errorMessage(error);
    // No HTTP response at all = the phone is offline or the server is
    // unreachable. The proof queue uses this to decide "retry later" vs
    // "this was rejected".
    error.isNetworkError = !error.response;
    error.status = error.response?.status;
    throw error;
  }
}

export const authApi = {
  // No `portal`: the backend uses the account's own role, which is "courier".
  login: (credentials) => unwrap(apiClient.post("/auth/login", credentials)),
  me: () => unwrap(apiClient.get("/auth/me")),
  logout: (refreshToken) => unwrap(apiClient.post("/auth/logout", { refreshToken })),
};

export const uploadApi = {
  /** Uploads a Blob/File as a private file and returns its `/uploads/private/<id>` url. */
  upload: async (file, filename = "photo.jpg") => {
    const formData = new FormData();
    formData.append("file", file, filename);
    formData.append("visibility", "private");
    const result = await unwrap(apiClient.post("/uploads", formData, { timeout: 90000 }));
    return result.fileUrl;
  },
  getPrivateFile: (fileUrl) => unwrap(apiClient.get(fileUrl, { responseType: "blob" })),
};

export const courierApi = {
  register: (details) => unwrap(apiClient.post("/couriers/register", details)),
  me: () => unwrap(apiClient.get("/couriers/me")),
  submitVerification: (details) => unwrap(apiClient.post("/couriers/me/verification", details)),
  updateProfile: (details) => unwrap(apiClient.patch("/couriers/me", details)),
  setOnline: (online) => unwrap(apiClient.patch("/couriers/me/online", { online })),
  proposeRate: (fee) => unwrap(apiClient.post("/couriers/me/rate", { fee })),
};

export const jobsApi = {
  available: () => unwrap(apiClient.get("/courier-jobs/available")),
  mine: (scope = "active") => unwrap(apiClient.get("/courier-jobs/mine", { params: { scope } })),
  detail: (orderId) => unwrap(apiClient.get(`/courier-jobs/${orderId}`)),
  earnings: () => unwrap(apiClient.get("/courier-jobs/earnings")),
  accept: (orderId) => unwrap(apiClient.post(`/courier-jobs/${orderId}/accept`)),
  release: (orderId, reason) => unwrap(apiClient.post(`/courier-jobs/${orderId}/release`, { reason })),
  // Proof steps — `body` is { photos, meta, note?, ...stage fields }.
  pickup: (orderId, body) => unwrap(apiClient.post(`/courier-jobs/${orderId}/pickup`, body)),
  transit: (orderId, body) => unwrap(apiClient.post(`/courier-jobs/${orderId}/transit`, body)),
  deliver: (orderId, body) => unwrap(apiClient.post(`/courier-jobs/${orderId}/deliver`, body)),
  fail: (orderId, body) => unwrap(apiClient.post(`/courier-jobs/${orderId}/fail`, body)),
};

export const notificationApi = {
  list: () => unwrap(apiClient.get("/notifications", { params: { audience: "courier" } })),
  markRead: (id) => unwrap(apiClient.patch(`/notifications/${id}/read`)),
  markAllRead: () => unwrap(apiClient.patch("/notifications/read-all", { audience: "courier" })),
};

export default apiClient;
