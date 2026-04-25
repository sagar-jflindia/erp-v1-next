import { api } from "@/utils/api";
import { ENDPOINTS } from "@/utils/lib";

export const categoryService = {
  getAll:  (params)     => api(ENDPOINTS.CATEGORY.LIST,   { method: "POST", body: params }),
  getById: (id)         => api(ENDPOINTS.CATEGORY.GET,    { method: "POST", body: { id } }),
};