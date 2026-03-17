import React, { useState } from "react";
import LoginScreen from "./components/auth/LoginScreen";
import AgencyRegistration from "./components/auth/AgencyRegistration";
import PortalRouter from "./components/PortalRouter";
import { useData } from "./context/DataContext";

/**
 * App.tsx
 * --------------------------------------------------
 * Root application decision layer.
 *
 * Responsibilities:
 * - Authentication gate (logged in vs logged out)
 * - Auth screen switching (login / register)
 * - Delegate ALL role-based routing to PortalRouter
 *
 * Rules:
 * - ZERO business logic
 * - ZERO API calls
 * - ZERO role awareness
 * - Predictable rendering only
 */

const App: React.FC = () => {
  const { isAuthenticated, isLoading, login } = useData();
  const [authView, setAuthView] = useState<"login" | "register">("login");

  /* ------------------------------------
   * Global loading gate
   * ---------------------------------- */
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rea-black text-white">
        <span className="animate-pulse text-xs tracking-wide opacity-80">
          Initialising MzansiPass…
        </span>
      </div>
    );
  }

  /* ------------------------------------
   * Authenticated users
   * ---------------------------------- */
  if (isAuthenticated) {
    return <PortalRouter />;
  }

  /* ------------------------------------
   * Unauthenticated users
   * ---------------------------------- */
  return (
    <div className="min-h-screen bg-rea-black font-sans overflow-hidden selection:bg-admin-accent/30">
      {authView === "login" ? (
        <LoginScreen
          onLogin={login}
          onSwitchToRegister={() => setAuthView("register")}
        />
      ) : (
        <AgencyRegistration
          onRegister={login}
          onSwitchToLogin={() => setAuthView("login")}
        />
      )}
    </div>
  );
};

export default App;
