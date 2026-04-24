import { useSelector } from "react-redux";
import { selectRole, selectPermissions } from "@/features/authSlice";

export const useCanAccess = () => {
  const role = useSelector(selectRole);
  const permissions = useSelector(selectPermissions);

  const publicModules = []; 

  const checkAccess = (module, action = "view") => {
    // 1. Super Admin
    if (role === "super_admin") {
      if (action === "view" || action === "edit") {
        return Object.assign(new Boolean(true), {
          allowed: true,
          days: 0 // 0 means unlimited
        });
      }
      return true;
    }

    // 2. Default allow if no module specified (for truly public pages if any)
    if (!module) return true;

    // 3. Check permission
    const perm = permissions?.find(p => p.module_name === module);

    if (!perm) return false;

    // 4. Special logic for view/edit days
    if (action === "view" || action === "edit") {
      const isAllowed = !!perm[`can_${action}`];
      const days = perm[`can_${action}_days`] || 0;
      
      // If we are returning an object, make it look like a boolean if used in boolean context
      // but also contain the days property.
      const result = Object.assign(new Boolean(isAllowed), {
        allowed: isAllowed,
        days: days
      });
      return result;
    }

    return !!perm[`can_${action}`];
  };

  return checkAccess;
};
