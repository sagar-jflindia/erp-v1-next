import { api } from "@/utils/api";
import { ENDPOINTS } from "@/utils/lib";

export const forwardingNoteService = {
  getAll:      (params) => api(ENDPOINTS.FORWARDING_NOTES.LIST,   { method: "POST", body: params }),
  getAllItems: (params) => api(ENDPOINTS.FORWARDING_NOTES.LIST_ITEMS, { method: "POST", body: params }),
  getById:     (fuid) => api(ENDPOINTS.FORWARDING_NOTES.GET, { method: "POST", body: { fuid } }),
  create:      (data) => api(ENDPOINTS.FORWARDING_NOTES.CREATE, { method: "POST", body: data }),
  update:      (fuid, data) => api(ENDPOINTS.FORWARDING_NOTES.UPDATE, { method: "POST", body: { fuid, ...data } }),
  delete:      (fuid) => api(ENDPOINTS.FORWARDING_NOTES.DELETE, { method: "POST", body: { fuid } }),
  unlockLock:  (fuid) => api(ENDPOINTS.FORWARDING_NOTES.UNLOCK_LOCK, { method: "POST", body: { fuid } }),
  getAvailableBoxes: (data) => api(ENDPOINTS.FORWARDING_NOTES.AVAILABLE_BOXES, { method: "POST", body: data }),
};