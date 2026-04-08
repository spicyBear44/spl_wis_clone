import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5001/api"
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
    const message = error.response?.data?.message || "Something went wrong.";
    return Promise.reject(new Error(message));
  }
);

export const authApi = {
  login: async (payload) => (await api.post("/auth/login", payload)).data,
  register: async (payload) => (await api.post("/auth/register", payload)).data
};

export const dashboardApi = {
  get: async () => (await api.get("/dashboard")).data
};

export const userApi = {
  search: async (query) => (await api.get("/users", { params: { query } })).data,
  listFriends: async () => (await api.get("/users/friends")).data,
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
  addExpense: async (groupId, payload) => (await api.post(`/groups/${groupId}/expenses`, payload)).data,
  addSettlement: async (groupId, payload) =>
    (await api.post(`/groups/${groupId}/settlements`, payload)).data
};
