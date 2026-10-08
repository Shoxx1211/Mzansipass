// Account API for the supervised commuter pilot.
// Browser/PWA auth stays same-origin through /api. Native Capacitor builds
// call the deployed beta API through Capacitor's native HTTP bridge so requests
// do not accidentally hit the bundled WebView asset server.
import {
  Capacitor,
  CapacitorCookies,
  CapacitorHttp,
} from "@capacitor/core";

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

interface NativeHttpResponse {
  status: number;
  data: unknown;
}

const IS_NATIVE = Capacitor.isNativePlatform();
const WEB_BASE =
  import.meta.env["VITE_AUTH_API_BASE_URL"] || "/api";
const NATIVE_BASE =
  import.meta.env["VITE_NATIVE_AUTH_API_BASE_URL"] ||
  "https://pulse-commuter-beta.onrender.com/api";
const BASE = (IS_NATIVE ? NATIVE_BASE : WEB_BASE).replace(/\/$/, "");

let accessToken: string | null = null;

const browserCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const found = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : null;
};

const nativeCookie = async (name: string): Promise<string | null> => {
  try {
    const result = await CapacitorCookies.getCookies({
      url: NATIVE_BASE,
    });
    return result.cookies?.[name] ?? null;
  } catch {
    return null;
  }
};

const csrfCookie = async (): Promise<string | null> =>
  IS_NATIVE
    ? nativeCookie("pulse_refresh_csrf")
    : browserCookie("pulse_refresh_csrf");

const readableMessage = (
  data: unknown,
  status: number,
): string => {
  if (data && typeof data === "object") {
    const object = data as { message?: unknown; msg?: unknown };
    if (typeof object.message === "string" && object.message.trim()) {
      return object.message;
    }
    if (typeof object.msg === "string" && object.msg.trim()) {
      return object.msg;
    }
  }

  if (typeof data === "string") {
    const trimmed = data.trim();

    // An HTML response means the request hit a website/static route instead of
    // the JSON API. Never expose raw "<!DOCTYPE" parsing errors to commuters.
    if (
      trimmed.startsWith("<!DOCTYPE") ||
      trimmed.startsWith("<html") ||
      trimmed.startsWith("<")
    ) {
      return "Pulse could not reach the account API. Please check your connection and try again.";
    }

    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed) as {
          message?: unknown;
          msg?: unknown;
        };
        if (typeof parsed.message === "string") return parsed.message;
        if (typeof parsed.msg === "string") return parsed.msg;
      } catch {
        // Keep the generic status message below for non-JSON server bodies.
      }
    }
  }

  return `Account server returned ${status}.`;
};

const errorMessage = async (response: Response): Promise<string> => {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const data = (await response.json()) as unknown;
      return readableMessage(data, response.status);
    } catch {
      return `Account server returned ${response.status}.`;
    }
  }

  try {
    return readableMessage(await response.text(), response.status);
  } catch {
    return `Account server returned ${response.status}.`;
  }
};

const nativePost = async <T>(
  path: string,
  payload?: Record<string, string>,
  useRefreshCsrf = false,
  authorization?: string,
): Promise<T> => {
  const csrf = useRefreshCsrf ? await csrfCookie() : null;

  let response: NativeHttpResponse;
  try {
    response = await CapacitorHttp.request({
      method: "POST",
      url: `${BASE}/auth/${path}`,
      headers: {
        "Content-Type": "application/json",
        ...(csrf ? { "X-CSRF-TOKEN": csrf } : {}),
        ...(authorization ? { Authorization: authorization } : {}),
      },
      data: payload ?? {},
      connectTimeout: 45_000,
      readTimeout: 45_000,
    });
  } catch (error) {
    const detail =
      error instanceof Error && error.message
        ? ` (${error.message})`
        : "";
    throw new Error(
      `Pulse could not reach the account server. Check your internet connection and try again.${detail}`,
    );
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(readableMessage(response.data, response.status));
  }

  if (typeof response.data === "string") {
    try {
      return JSON.parse(response.data) as T;
    } catch {
      throw new Error(
        readableMessage(response.data, response.status),
      );
    }
  }

  return response.data as T;
};

const browserPost = async <T>(
  path: string,
  payload?: Record<string, string>,
  useRefreshCsrf = false,
  authorization?: string,
): Promise<T> => {
  const csrf = useRefreshCsrf ? await csrfCookie() : null;
  const response = await fetch(`${BASE}/auth/${path}`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-TOKEN": csrf } : {}),
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(payload ?? {}),
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      readableMessage(await response.text(), response.status),
    );
  }

  return (await response.json()) as T;
};

const post = async <T>(
  path: string,
  payload?: Record<string, string>,
  useRefreshCsrf = false,
  authorization?: string,
): Promise<T> =>
  IS_NATIVE
    ? nativePost<T>(path, payload, useRefreshCsrf, authorization)
    : browserPost<T>(path, payload, useRefreshCsrf, authorization);

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
    return remember(
      await post<SessionResponse>("login", { email, password }),
    );
  },

  async signUp(email: string, password: string): Promise<PassengerAccount> {
    return remember(
      await post<SessionResponse>("register", { email, password }),
    );
  },

  async restore(): Promise<PassengerAccount | null> {
    try {
      return remember(
        await post<SessionResponse>("refresh", undefined, true),
      );
    } catch {
      accessToken = null;
      return null;
    }
  },

  async signOut(): Promise<void> {
    await post<{ message: string }>("logout", undefined, true);
    accessToken = null;
  },

  async deleteAccount(password: string): Promise<void> {
    if (!accessToken) {
      throw new Error("Please sign in again.");
    }

    await post<{ message: string }>(
      "delete",
      { password },
      false,
      `Bearer ${accessToken}`,
    );
    accessToken = null;
  },
};
