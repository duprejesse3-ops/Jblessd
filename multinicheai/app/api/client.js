// api/client.js
// Central API client for multiNicheAI 1.0 — talks to the FastAPI backend.
// Same client works on Windows (via Electron/Tauri wrapper) and phone (Expo).

import AsyncStorage from "@react-native-async-storage/async-storage";

// Point this at your deployed backend. Keep out of source control for prod.
const API_BASE_URL = "https://api.jblessd.com";

async function getToken() {
  return AsyncStorage.getItem("access_token");
}

async function request(path, options = {}) {
  const token = await getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || "Something went wrong. Try again.");
  }
  return data;
}

export const api = {
  signup: (email, password) =>
    request("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) }),

  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  estimateCost: (message) =>
    request("/chat/estimate", { method: "POST", body: JSON.stringify({ message }) }),

  sendMessage: (message, conversationHistory) =>
    request("/chat/send", {
      method: "POST",
      body: JSON.stringify({ message, conversation_history: conversationHistory }),
    }),

  startCheckout: (packId) =>
    request(`/billing/checkout/${packId}`, { method: "POST" }),

  saveToken: async (token) => AsyncStorage.setItem("access_token", token),
  clearToken: async () => AsyncStorage.removeItem("access_token"),
};
