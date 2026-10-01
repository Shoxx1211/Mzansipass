// Account API for the supervised commuter pilot.
// Access JWT lives in module memory only, not localStorage/sessionStorage.
// Refresh is an HttpOnly, SameSite cookie. All auth calls share one origin
// through the /api reverse proxy (Vite dev or production gateway).
export interface PassengerAccount {
  id: string;
  email: string;
  name: string;
  role: "passenger";
}

interface SessionResponse {
  user: PassengerAccount;
  access_token: string;
}

const BASE = (import.meta.env.VITE_AUTH_API_BASE_URL || "/api").replace(/\/$/, "");
let accessToken: string | null = null;

const cookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const found = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : null;
};

const errorMessage = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as { message?: string; msg?: string };
    return data.message ?? data.msg ?? `Account server returned ${response.status}.`;
  } catch {
    return `Account server returned ${response.status}.`;
  }
};

const post = async <T>(
  path: string,
  payload?: Record<string, string>,
  useRefreshCsrf = false,
): Promise<T> => {
  const csrf = useRefreshCsrf ? cookie("pulse_refresh_csrf") : null;
  const response = await fetch(`${BASE}/auth/${path}`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-TOKEN": csrf } : {}),
    },
    body: JSON.stringify(payload ?? {}),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as T;
};

const remember = (data: SessionResponse): PassengerAccount => {
  if (!data.access_token || !data.user?.id || !data.user?.email) {
    throw new Error("Invalid account response from server.");
  }
  accessToken = data.access_token;
  return data.user;
};

export const AuthApi = {
  get accessToken() {
    return accessToken;
  },
  async signIn(email: string, password: string): Promise<PassengerAccount> {
    return remember(await post<SessionResponse>("login", { email, password }));
  },
  async signUp(email: string, password: string): Promise<PassengerAccount> {
    return remember(await post<SessionResponse>("register", { email, password }));
  },
  async restore(): Promise<PassengerAccount | null> {
    try {
      return remember(await post<SessionResponse>("refresh", undefined, true));
    } catch {
      accessToken = null;
      return null;
    }
  },
  async signOut(): Promise<void> {
    try {
      await post<{ message: string }>("logout", undefined, true);
    } finally {
      accessToken = null;
    }
  },
  async deleteAccount(password: string): Promise<void> {
    if (!accessToken) throw new Error("Please sign in again.");
    const response = await fetch(`${BASE}/auth/delete`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) throw new Error(await errorMessage(response));
    accessToken = null;
  },
};
