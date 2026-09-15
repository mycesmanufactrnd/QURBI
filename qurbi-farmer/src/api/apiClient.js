/// <reference types="vite/client" />

import axios from "axios";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api").replace(/\/$/, "");

export const ACCESS_TOKEN_KEY = "qurbi_access_token";
export const REFRESH_TOKEN_KEY = "qurbi_refresh_token";

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

export function setSessionTokens({ accessToken, refreshToken } = {}) {
  writeToken(ACCESS_TOKEN_KEY, accessToken);
  writeToken(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearSessionTokens() {
  writeToken(ACCESS_TOKEN_KEY, null);
  writeToken(REFRESH_TOKEN_KEY, null);
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshRequest = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const refreshToken = getRefreshToken();
    const isAuthRequest = originalRequest?.url?.includes("/auth/login") ||
      originalRequest?.url?.includes("/auth/refresh");

    if (error.response?.status !== 401 || originalRequest?._retry || !refreshToken || isAuthRequest) {
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
        .finally(() => {
          refreshRequest = null;
        });

      const accessToken = await refreshRequest;
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      clearSessionTokens();
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
    throw error;
  }
}

export const authApi = {
  register: (details) => unwrap(apiClient.post("/auth/register", details)),
  login: (credentials) => unwrap(apiClient.post("/auth/login", credentials)),
  me: () => unwrap(apiClient.get("/auth/me")),
  refresh: (refreshToken) => unwrap(apiClient.post("/auth/refresh", { refreshToken })),
  logout: (refreshToken) => unwrap(apiClient.post("/auth/logout", { refreshToken })),
};

export default apiClient;
