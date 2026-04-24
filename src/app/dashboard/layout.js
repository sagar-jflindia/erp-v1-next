"use client";

import { useSelector } from "react-redux";
import RootLayoutComponent from "@/components/layout/RootLayout";
import PermissionGuard from "@/components/PermissionGuard";
import { useSocket } from "@/hooks/useSocket";
import { selectUser } from "@/features/authSlice";

export default function DashboardLayout({ children }) {
  const user = useSelector(selectUser);
  useSocket(user?.id);

  return (
    <RootLayoutComponent>
      <PermissionGuard>
        {children}
      </PermissionGuard>
    </RootLayoutComponent>
  );
}