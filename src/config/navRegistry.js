import { Zap, Package, Truck, Users, Database, FileSearch, BarChart3, Globe, UserPlus, Map, Boxes, ClipboardCheck, ListChecksIcon, Locate, ClipboardList, Scale, Sticker } from "lucide-react";
import { ROUTES } from "@/utils/routes";

export const NAV_REGISTRY = [
  { id: "dashboard", name: "System Dashboard", icon: <Zap size={16} />, href: ROUTES.DASHBOARD, module: "dashboard" },
  { id: "users", name: "User Management", icon: <UserPlus size={16} />, href: ROUTES.USERS, module: "users" },
  { id: "modules", name: "System Modules", icon: <Globe size={16} />, href: ROUTES.MODULES, module: "modules" },
  { id: "training", name: "Training Videos", icon: <ListChecksIcon size={16} />, href: ROUTES.TRAINING, module: "training_videos" },
  { id: "product-master", name: "Product Master", icon: <Package size={16} />, href: ROUTES.PRODUCT_MASTER, module: "product_master" },
  {
    id: "customer-master",
    name: "Customer Master",
    icon: <Users size={16} />,
    module: "customer_master",
    subItems: [
      { id: "customer-list", name: "View Customer List", icon: <Boxes size={14} />, href: ROUTES.CUSTOMER_MASTER, module: "customer_master" },
      { id: "customer-item-code", name: "Customer Item Codes", icon: <Map size={14} />, href: ROUTES.CUSTOMER_ITEM_CODE, module: "customer_item_code" }
    ]
  },
  { id: "packing-entry", name: "Packing Entry", icon: <Truck size={16} />, href: ROUTES.PACKING_ENTRY, module: "packing_entry" },
  { id: "packing-standard", name: "Packing Standard", icon: <ClipboardList size={16} />, href: ROUTES.PACKING_STANDARD, module: "packing_standard" },
  { id: "inventory-box-table", name: "Inventory Box Table", icon: <Boxes size={16} />, href: ROUTES.BOX_TABLE, module: "box_table" },
  {
    id: "sticker-management",
    name: "Sticker Management",
    icon: <Sticker size={16} />,
    module: "box_table",
    subItems: [
      { id: "sticker-dashboard", name: "Sticker Download Logs", icon: <Boxes size={14} />, href: ROUTES.STICKER_MANAGEMENT, module: "box_table" },
      { id: "sticker-override", name: "Change / Override Customer", icon: <Map size={14} />, href: ROUTES.STICKER_OVERRIDE, module: "box_table" }
    ]
  },
  { id: "location-master", name: "Location Master", icon: <Locate size={16} />, href: ROUTES.LOCATION_MASTER, module: "location_master" },
  { id: "inward-entry", name: "Inventory Inward Entry", icon: <ClipboardCheck size={16} />, href: ROUTES.INVENTORY_INWARD, module: "inventory_inwards" },
  { id: "forwarding-note", name: "Forwarding Note", icon: <FileSearch size={16} />, href: ROUTES.FORWARDING_NOTE, module: "forwarding_note_master" },
  // { id: "forwarding-note-item-wise", name: "Item Wise Forwarding Note", icon: <FileSearch size={16} />, href: ROUTES.FORWARDING_NOTE_ITEM, module: "forwarding_note_item_wise" },
  { id: "store-outward", name: "Store Outward Entry", icon: <Truck size={16} />, href: ROUTES.OUT_ENTRY, module: "out_entry" },
  { id: "stock-adjustment", name: "Stock Adjustment", icon: <Scale size={16} />, href: ROUTES.STOCK_ADJUSTMENT, module: "stock_adjustment" },
  { id: "inventory-report", name: "Inventory Reports", icon: <BarChart3 size={16} />, href: ROUTES.ANALYTICS, module: "inventory_report" },
  { id: "logs", name: "Activity Logs", icon: <Database size={16} />, href: ROUTES.LOGS, module: "logs" },
];