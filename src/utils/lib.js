// Local IP
// const API_BASE_URL = "/api";
// const FILE_BASE_URL = "";

// Local
const API_BASE_URL = "https://apiinside.jflindia.com/api";
const FILE_BASE_URL = "https://apiinside.jflindia.com";

// Production
// const API_BASE_URL = "https://tasknode.jflindia.com/api";
// const FILE_BASE_URL = "https://tasknode.jflindia.com";

const ENDPOINTS = {
  USERS: {
    LIST: "/users/list",
    ME: "/users/me",
    GET: "/users/get",
    CREATE: "/users/create",
    UPDATE: "/users/update",
    DELETE: "/users/delete",
    LOGIN: "/users/login",
    LOGOUT: "/users/logout",
  },

  MODULES: {
    LIST: "/modules/list",
    GET: "/modules/get",
    CREATE: "/modules/create",
    UPDATE: "/modules/update",
    DELETE: "/modules/delete",
    TOGGLE_STATUS: "/modules/toggle-status",
  },

  CATEGORY: {
    LIST: "/category/list",
    GET: "/category/get",
    CREATE: "/category/create",
    UPDATE: "/category/update",
    DELETE: "/category/delete",
  },

  PERMISSIONS: {
    LIST: "/permissions/list",
    CREATE: "/permissions/create",
    BULK_CREATE: "/permissions/bulk-create",
    GET: "/permissions/get",
    UPDATE: "/permissions/update",
    DELETE: "/permissions/delete",
  },

  TRAINING_VIDEOS: {
    LIST: "/training-videos/list",
    GET: "/training-videos/get",
    CREATE: "/training-videos/create",
    UPDATE: "/training-videos/update",
    DELETE: "/training-videos/delete",
  },

  MASTER: {
    ITEMS: {
      LIST: "/master/items/list",
      GET: "/master/items/get",
    },
    LEDGERS: {
      LIST: "/master/ledgers/list",
      GET: "/master/ledgers/get",
    },
    PARTY_RATES: { LIST: "/master/party-rates/list" },
    DAILY_PROD: { LIST: "/master/daily-prod/list" },
  },

  LOCATIONS: {
    LIST:   "/locations/list",
    GET:    "/locations/get",
    CREATE: "/locations/create",
    UPDATE: "/locations/update",
    DELETE: "/locations/delete",
  },

  ACTIVITY_LOGS: {
    LIST:   "/activity-logs/list",
    GET:    "/activity-logs/get",
    UPDATE: "/activity-logs/update",
    DELETE: "/activity-logs/delete",
  },  

  PACKING_STANDARD: {
    LIST: "/packing-standard/list",
    GET: "/packing-standard/get",
    CREATE: "/packing-standard/create",
    UPDATE: "/packing-standard/update",
    DELETE: "/packing-standard/delete",
  },

  STOCK_ADJUSTMENT: {
    LIST: "/stock-adjustment/list",
    GET: "/stock-adjustment/get",
    CREATE: "/stock-adjustment/create",
    UPDATE: "/stock-adjustment/update",
    DELETE: "/stock-adjustment/delete",
  },

  BOXES: {
    LIST: "/boxes/list",
    GET: "/boxes/get",
    CREATE: "/boxes/create",
    UPDATE: "/boxes/update",
    DELETE: "/boxes/delete",
    
    // sticker
    STICKER_FETCH:    "/boxes/sticker/fetch",
    STICKER_GENERATE: "/boxes/sticker/generate",
  
    // download tracking
    STICKER_DOWNLOAD:         "/boxes/sticker/download",
    STICKER_DOWNLOAD_BULK:    "/boxes/sticker/download-bulk",
    STICKER_RENDER_SINGLE:    "/boxes/sticker/render-single",
    STICKER_RENDER_BULK:      "/boxes/sticker/render-bulk",
  
    // customer override
    STICKER_OVERRIDE_CUST: "/boxes/sticker/override-cust",
  
    // history & reports
    STICKER_DOWNLOAD_HISTORY: "/boxes/sticker/download-history",
    STICKER_DOWNLOAD_SUMMARY: "/boxes/sticker/download-summary",
    STICKER_MANAGEMENT_LIST: "/boxes/sticker/management-list",
    STICKER_OVERRIDE_REQUEST: "/boxes/sticker/override/request",
    STICKER_OVERRIDE_UPDATE: "/boxes/sticker/override/update",
    STICKER_OVERRIDE_LIST: "/boxes/sticker/override/list",
    STICKER_OVERRIDE_APPROVE: "/boxes/sticker/override/approve",
  },

  INVENTORY_INWARDS: {
    LIST: "/inventory-inwards/list",
    GET: "/inventory-inwards/get",
    CREATE: "/inventory-inwards/create",
    UPDATE: "/inventory-inwards/update",
    DELETE: "/inventory-inwards/delete",
  },

  FORWARDING_NOTES: {
    LIST: "/forwarding-notes/list",
    LIST_ITEMS: "/forwarding-notes/list-items",
    GET: "/forwarding-notes/get",
    CREATE: "/forwarding-notes/create",
    UPDATE: "/forwarding-notes/update",
    DELETE: "/forwarding-notes/delete",
    AVAILABLE_BOXES: "/forwarding-notes/available-boxes",
  },

  FORWARDING_NOTE_ITEMS: {
    LIST: "/forwarding-note-items/list",
    GET: "/forwarding-note-items/get",
    CREATE: "/forwarding-note-items/create",
    UPDATE: "/forwarding-note-items/update",
    DELETE: "/forwarding-note-items/delete",
  },

  OUT_ENTRIES: {
    LIST: "/out-entries/list",
    GET: "/out-entries/get",
    CREATE: "/out-entries/create",
    UPDATE: "/out-entries/update",
    DELETE: "/out-entries/delete",
    VERIFY_BOX: "/out-entries/verify-box",
    GET_FUID_DETAILS: "/out-entries/get-details",
  },

  DASHBOARD: {
    STATS: "/dashboard/stats",
  },
};

export { API_BASE_URL, FILE_BASE_URL, ENDPOINTS };
