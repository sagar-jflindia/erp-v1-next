import { api } from "@/utils/api";
import { ENDPOINTS } from "@/utils/lib";

export const masterService = {
  // Items
  getItems:      (params) => api(ENDPOINTS.MASTER.ITEMS.LIST,   { method: "POST", body: params }),
  getItemById:   (id)     => api(ENDPOINTS.MASTER.ITEMS.GET,    { method: "POST", body: { id } }),

  // Ledger
  getLedgers:    (params) => api(ENDPOINTS.MASTER.LEDGERS.LIST,  { method: "POST", body: params }),
  getLedgerById: (id)     => api(ENDPOINTS.MASTER.LEDGERS.GET,   { method: "POST", body: { id } }),

  // Party Rate
  getPartyRates: (params) => api(ENDPOINTS.MASTER.PARTY_RATES.LIST, { method: "POST", body: params }),

  // Daily Prod
  getDailyProd:  (params) => api(ENDPOINTS.MASTER.DAILY_PROD.LIST,  { method: "POST", body: params }),
};