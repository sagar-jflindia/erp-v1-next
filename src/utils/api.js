import { API_BASE_URL } from "./lib";

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
      throw new Error(data?.message || `Request failed with status ${res.status}`);
    }

    return data;
  } catch (err) {
    throw err;
  }
}