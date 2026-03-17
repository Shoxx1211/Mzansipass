import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

/* =======================
   TYPES
======================= */

export interface User {
  id: number;
  full_name: string;
  email: string;
}

export interface Card {
  id: number;
  card_uid: string;
  is_active: boolean;
}

export interface Trip {
  id: number;
  card_uid: string;
  tap_in_time: string;
  tap_out_time: string | null;
  fare: number | null;
}

interface DataContextType {
  user: User | null;
  token: string | null;
  cards: Card[];
  trips: Trip[];
  balance: number;
  loading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshData: () => Promise<void>;
}

/* =======================
   CONTEXT
======================= */

const DataContext = createContext<DataContextType | undefined>(undefined);

/* =======================
   CONFIG
======================= */

const API_BASE = import.meta.env.VITE_API_BASE_URL;

/* =======================
   PROVIDER
======================= */

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("auth_token")
  );
  const [cards, setCards] = useState<Card[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /* =======================
     HELPERS
  ======================= */

  const authHeaders = () => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });

  const handleError = (err: any) => {
    console.error(err);
    setError(
      err?.message || "Something went wrong. Please try again."
    );
  };

  /* =======================
     AUTH
  ======================= */

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) throw new Error("Invalid credentials");

      const data = await res.json();

      localStorage.setItem("auth_token", data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    setToken(null);
    setUser(null);
    setCards([]);
    setTrips([]);
    setBalance(0);
  };

  /* =======================
     DATA FETCHING
  ======================= */

  const fetchUserData = async () => {
    const res = await fetch(`${API_BASE}/me`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Session expired");
    return res.json();
  };

  const fetchCards = async () => {
    const res = await fetch(`${API_BASE}/cards`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load cards");
    return res.json();
  };

  const fetchTrips = async () => {
    const res = await fetch(`${API_BASE}/trips`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load trips");
    return res.json();
  };

  const fetchBalance = async () => {
    const res = await fetch(`${API_BASE}/wallet/balance`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load balance");
    return res.json();
  };

  const refreshData = async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const [userData, cardData, tripData, balanceData] =
        await Promise.all([
          fetchUserData(),
          fetchCards(),
          fetchTrips(),
          fetchBalance(),
        ]);

      setUser(userData);
      setCards(cardData);
      setTrips(tripData);
      setBalance(balanceData.balance);
    } catch (err) {
      handleError(err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  /* =======================
     INIT
  ======================= */

  useEffect(() => {
    if (token) {
      refreshData();
    } else {
      setLoading(false);
    }
  }, [token]);

  /* =======================
     CONTEXT VALUE
  ======================= */

  const value: DataContextType = {
    user,
    token,
    cards,
    trips,
    balance,
    loading,
    error,
    login,
    logout,
    refreshData,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

/* =======================
   HOOK
======================= */

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useData must be used within DataProvider");
  }
  return ctx;
};
