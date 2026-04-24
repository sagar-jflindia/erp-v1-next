import { api } from "@/utils/api";
import { ENDPOINTS } from "@/utils/lib";

export const trainingVideoService = {
  getAll:  (params)   => api(ENDPOINTS.TRAINING_VIDEOS.LIST,   { method: "POST", body: params }),
  getById: (id)       => api(ENDPOINTS.TRAINING_VIDEOS.GET,    { method: "POST", body: { id } }),
  create:  (data)     => api(ENDPOINTS.TRAINING_VIDEOS.CREATE, { method: "POST", body: data }),
  update:  (id, data) => api(ENDPOINTS.TRAINING_VIDEOS.UPDATE, { method: "POST", body: { id, ...data } }),
  delete:  (id)       => api(ENDPOINTS.TRAINING_VIDEOS.DELETE, { method: "POST", body: { id } }),
};