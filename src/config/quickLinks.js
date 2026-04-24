import { ROUTES } from "@/utils/routes";
import { FileText, Activity, ShieldCheck, Clock } from "lucide-react";

export const QUICK_LINKS_CONFIG = [
  { id: "docs", label: "Home", icon: <FileText size={13} />, path: ROUTES.DASHBOARD }, 
  { id: "nodes", label: "Modules", icon: <Activity size={13} />, path: ROUTES.MODULES, module: "modules" }, 
  { id: "security", label: "Users", icon: <ShieldCheck size={13} />, path: ROUTES.USERS, module: "users" }, 
  { id: "logs", label: "Logs", icon: <Clock size={13} />, path: ROUTES.LOGS, module: "logs" },
];