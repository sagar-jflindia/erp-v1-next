import { API_BASE_URL } from "./lib";

const MODULE_DEACTIVATED_MESSAGE = "This module has been deactivated by authorized personnel.";

export async function api(endpoint, { method = "GET", body, headers = {} } = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const options = {
    method,
    credentials: "include", // send cookies
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  };

  try {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      if (typeof window !== "undefined") {
        window.__LAST_API_ERROR__ = {
          status: res.status,
          message: data?.message || "",
          endpoint,
          ts: Date.now(),
        };
      }
      const error = new Error(data?.message || `Request failed with status ${res.status}`);
      error.status = res.status;
      error.payload = data;
      throw error;
    }

    if (typeof window !== "undefined" && window.__LAST_API_ERROR__) {
      const last = window.__LAST_API_ERROR__;
      if (last?.endpoint === endpoint) {
        window.__LAST_API_ERROR__ = null;
      }
    }

    return data;
  } catch (err) {
    throw err;
  }
}