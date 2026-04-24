import { api } from "@/utils/api";
import { ENDPOINTS } from "@/utils/lib";

export const inventoryInwardService = {
  getAll:  (params) => api(ENDPOINTS.INVENTORY_INWARDS.LIST,   { method: "POST", body: params }),
  getById: (in_uid) => api(ENDPOINTS.INVENTORY_INWARDS.GET, { method: "POST", body: { in_uid } }),
  create:  (data) => api(ENDPOINTS.INVENTORY_INWARDS.CREATE, { method: "POST", body: data }),
  update:  (in_uid, data) => api(ENDPOINTS.INVENTORY_INWARDS.UPDATE, { method: "POST", body: { in_uid, ...data } }),
  delete:  (in_uid) => api(ENDPOINTS.INVENTORY_INWARDS.DELETE, { method: "POST", body: { in_uid } }),
};