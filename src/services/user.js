import { api } from "@/utils/api";
import { ENDPOINTS } from "@/utils/lib";

export const userService = {
  // ===================== CRUD =====================
  getAll:  (params) => api(ENDPOINTS.USERS.LIST,   { method: "POST", body: params }),
  getById: (id)     => api(ENDPOINTS.USERS.GET,    { method: "POST", body: { id } }),
  create:  (data)   => api(ENDPOINTS.USERS.CREATE, { method: "POST", body: data }),
  update:  (id, data) => api(ENDPOINTS.USERS.UPDATE, { method: "POST", body: { id, ...data } }),
  delete:  (id)     => api(ENDPOINTS.USERS.DELETE, { method: "POST", body: { id } }),
  me:      ()       => api(ENDPOINTS.USERS.ME, { method: "POST" }),

  // ===================== AUTHENTICATION =====================
  login:  (credentials) => api(ENDPOINTS.USERS.LOGIN,  { method: "POST", body: credentials }),
  logout: ()            => api(ENDPOINTS.USERS.LOGOUT, { method: "POST" }),
};