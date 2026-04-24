import { api } from "@/utils/api";
import { ENDPOINTS } from "@/utils/lib";

export const categoryService = {
  getAll:  (params)     => api(ENDPOINTS.CATEGORY.LIST,   { method: "POST", body: params }),
  getById: (id)         => api(ENDPOINTS.CATEGORY.GET,    { method: "POST", body: { id } }),
  create:  (data)       => api(ENDPOINTS.CATEGORY.CREATE, { method: "POST", body: data }),
  update:  (id, data)   => api(ENDPOINTS.CATEGORY.UPDATE, { method: "POST", body: { id, data } }),
  delete:  (id)         => api(ENDPOINTS.CATEGORY.DELETE, { method: "POST", body: { id } }),
};