import { api } from "@/utils/api";
import { ENDPOINTS } from "@/utils/lib";

export const logService = {
  getAll:   (params)    =>   api(ENDPOINTS.ACTIVITY_LOGS.LIST, { method: "POST", body: params }),
  getById:  (id)        =>   api(ENDPOINTS.ACTIVITY_LOGS.GET, { method: "POST", body: { id } }),
  update:   (id, data)  =>   api(ENDPOINTS.ACTIVITY_LOGS.UPDATE, { method: "POST", body: { id, ...data } }),
  delete:   (id)        =>   api(ENDPOINTS.ACTIVITY_LOGS.DELETE, { method: "POST", body: { id } }),
};
