import { api } from "@/utils/api";
import { ENDPOINTS } from "@/utils/lib";

export const outEntryService = {
  getAll:  (params) => api(ENDPOINTS.OUT_ENTRIES.LIST,   { method: "POST", body: params }),
  getById: (out_uid) => api(ENDPOINTS.OUT_ENTRIES.GET, { method: "POST", body: { out_uid } }),
  create:  (data) => api(ENDPOINTS.OUT_ENTRIES.CREATE, { method: "POST", body: data }),
  update:  (out_uid, data) => api(ENDPOINTS.OUT_ENTRIES.UPDATE, { method: "POST", body: { out_uid, ...data } }),
  delete:      (out_uid) => api(ENDPOINTS.OUT_ENTRIES.DELETE, { method: "POST", body: { out_uid } }),
  verifyBox:   (body) => api(ENDPOINTS.OUT_ENTRIES.VERIFY_BOX, { method: "POST", body }),
  getFuidDetails: (fuid) => api(ENDPOINTS.OUT_ENTRIES.GET_FUID_DETAILS, { method: "POST", body: { fuid } }),
  lockFuid: (fuid) => api(ENDPOINTS.OUT_ENTRIES.LOCK_FUID, { method: "POST", body: { fuid } }),
};