import React from "react";
import { useData } from "../context/DataContext";

import AdminPortal from "./admin/AdminPortal";
import FinancePortal from "./admin/FinancePortal";
import Dashboard from "./dashboard/Dashboard";

/**
 * PortalRouter.tsx
 *
 * Single responsibility:
 * - Route authenticated users to the correct portal
 * - Enforce role-based access
 *
 * ❌ No auth checks
 * ❌ No API calls
 * ❌ No redirects
 */

const PortalRouter: React.FC = () => {
  const { user, logout } = useData();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rea-black text-white">
        <span className="text-sm opacity-70">
          Session error. Please log in again.
        </span>
      </div>
    );
  }

  switch (user.role) {
    case "admin":
      return <AdminPortal onLogout={logout} />;

    case "finance":
      return <FinancePortal onLogout={logout} />;

    case "agency":
      return <Dashboard onLogout={logout} />;

    default:
      return (
        <div className="min-h-screen flex items-center justify-center bg-rea-black text-red-400">
          <div className="text-center space-y-2">
            <p className="text-sm font-semibold">Access denied</p>
            <p className="text-xs opacity-70">
              Your account role is not recognised.
            </p>
            <button
              onClick={logout}
              className="mt-3 text-xs underline hover:text-red-300"
            >
              Log out
            </button>
          </div>
        </div>
      );
  }
};

export default PortalRouter;
