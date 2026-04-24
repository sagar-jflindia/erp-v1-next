"use client";
import { useState, useEffect } from "react";
import Sidebar from "./Sidebar"; 
import Navbar from "./Navbar";
import { THEME_CONFIG } from "@/config/theme";
import { useSelector } from "react-redux";
import { selectUser } from "@/features/authSlice";
import { usePathname } from "next/navigation";
import { useCanAccess } from "@/hooks/useCanAccess";
import { NAV_REGISTRY } from "@/config/navRegistry";
import { ShieldAlert, Lock, Loader2 } from "lucide-react";

export default function RootLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const userData = useSelector(selectUser);
  const pathname = usePathname();
  const canAccess = useCanAccess();

  useEffect(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    setCollapsed(saved === "true");
    setIsLoaded(true);
  }, []);

  const hasPageAccess = useMemo(() => {
    if (!isLoaded) return true;
    
    // 1. Find the module associated with current path
    let currentModule = null;
    const findModule = (items) => {
      for (const item of items) {
        if (item.href === pathname) {
          currentModule = item.module;
          return;
        }
        if (item.subItems) {
          const sub = item.subItems.find(s => s.href === pathname);
          if (sub) {
            currentModule = sub.module;
            return;
          }
        }
      }
    };
    findModule(NAV_REGISTRY);

    // 2. If no module found, it's a public/unknown page (like Dashboard)
    if (!currentModule) return true;

    // 3. Check permission
    const access = canAccess(currentModule);
    return typeof access === 'object' ? access.allowed : access;
  }, [pathname, isLoaded, canAccess]);

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const newState = !prev;
      localStorage.setItem("sidebarCollapsed", newState.toString());
      return newState;
    });
  };

  const contentMargin = collapsed ? "md:ml-14" : "md:ml-56";

  if (!isLoaded) return null;

  return (
    <div className={`flex h-screen ${THEME_CONFIG.sidebarBg} overflow-hidden font-sans`}>
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        collapsed={collapsed}
        toggleCollapsed={handleToggleCollapse}
      />

      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ml-0 ${contentMargin}`}>
        <Navbar
          setSidebarOpen={setSidebarOpen}
          collapsed={collapsed}
          whoAmi={{ name: userData?.name || "JFL Admin", email: userData?.email || "admin@jfl-dynamics.io" }}
        />

        <main className={`flex-1 overflow-y-auto overflow-x-hidden ${THEME_CONFIG.footerBg}`}>
          <div className="w-full min-h-full from-black/20 to-transparent bg-[#f0f4f8]">
            <div className="mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500 min-h-full p-2 md:p-2">
              {hasPageAccess ? (
                children
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
                  <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 border-2 border-dashed border-rose-200 animate-pulse">
                    <Lock size={40} className="text-rose-500" />
                  </div>
                  <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">Access Restricted</h1>
                  <p className="text-slate-500 text-sm max-w-md leading-relaxed mb-8">
                    You do not have the required permissions to view this module. Please contact your administrator to request access.
                  </p>
                  <button 
                    onClick={() => window.location.href = '/'}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2"
                  >
                    <ShieldAlert size={16} />
                    Back to Dashboard
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90] md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}