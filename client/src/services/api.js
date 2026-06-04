import axios from "axios";

const defaultApiUrl = import.meta.env.DEV ? "http://localhost:5001" : "";
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim() || defaultApiUrl;

function withoutTrailingSlash(value) {
  return value.replace(/\/$/, "");
}

function withoutApiSuffix(value) {
  return value.replace(/\/api\/?$/, "");
}

export const API_ORIGIN = configuredApiUrl ? withoutApiSuffix(withoutTrailingSlash(configuredApiUrl)) : "";
export const API_BASE_URL = API_ORIGIN ? `${API_ORIGIN}/api` : "/api";

const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sw_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const path = error.config?.url || "request";
    const fallback = status ? `Request failed (${status}) while loading ${path}.` : `Could not reach API while loading ${path}.`;
    const message = error.response?.data?.message || fallback;
    return Promise.reject(new Error(message));
  }
);

export const authApi = {
  login: async (payload) => (await api.post("/auth/login", payload)).data,
  me: async () => (await api.get("/auth/me")).data,
  register: async (payload) => (await api.post("/auth/register", payload)).data,
  forgotPassword: async (payload) => (await api.post("/auth/forgot-password", payload)).data,
  resetPassword: async (token, payload) => (await api.post(`/auth/reset-password/${token}`, payload)).data
};

export const dashboardApi = {
  get: async () => (await api.get("/dashboard")).data
};

export const noteApi = {
  list: async () => (await api.get("/notes")).data,
  create: async (payload) => (await api.post("/notes", payload)).data
};

export const userApi = {
  search: async (query) => (await api.get("/users", { params: { query } })).data,
  listFriends: async () => (await api.get("/users/friends")).data,
  updateProfilePhoto: async (payload) => (await api.put("/users/profile-photo", payload)).data,
  addFriend: async (payload) => (await api.post("/users/friends", payload)).data,
  acceptFriend: async (payload) => (await api.post("/users/friends/accept", payload)).data,
  rejectFriend: async (payload) => (await api.post("/users/friends/reject", payload)).data,
  removeFriend: async (payload) => (await api.post("/users/friends/remove", payload)).data
};

export const groupApi = {
  list: async () => (await api.get("/groups")).data,
  create: async (payload) => (await api.post("/groups", payload)).data,
  details: async (groupId) => (await api.get(`/groups/${groupId}`)).data,
  addMember: async (groupId, payload) => (await api.post(`/groups/${groupId}/members`, payload)).data,
  updateMembers: async (groupId, payload) => (await api.put(`/groups/${groupId}/members`, payload)).data,
  delete: async (groupId) => (await api.delete(`/groups/${groupId}`)).data,
  addExpense: async (groupId, payload) => (await api.post(`/groups/${groupId}/expenses`, payload)).data,
  updateExpense: async (groupId, expenseId, payload) =>
    (await api.put(`/groups/${groupId}/expenses/${expenseId}`, payload)).data,
  addSettlement: async (groupId, payload) =>
    (await api.post(`/groups/${groupId}/settlements`, payload)).data
};
