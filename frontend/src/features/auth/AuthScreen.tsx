import React, { useState } from "react";
import { AuthApi, type PassengerAccount } from "../../services/authApi";

interface AuthScreenProps {
  onLogin: (user: PassengerAccount) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setMessage(null);

    try {
      const account =
        mode === "register"
          ? await AuthApi.signUp(email.trim().toLowerCase(), password)
          : await AuthApi.signIn(email.trim().toLowerCase(), password);
      setPassword("");
      onLogin(account);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not contact the account server. Check your connection.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#040917] px-4 py-10 text-white">
      <div className="w-full max-w-[430px]">
        <div className="mb-7 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-emerald-300 text-lg font-black text-[#07101d]">P</span>
          <h1 className="mt-4 text-3xl font-black tracking-tight">Pulse</h1>
          <p className="mt-2 text-sm text-white/45">The rhythm of movement.</p>
        </div>

        <div className="premium-glass compact-card p-6 sm:p-7">
          <h2 className="text-xl font-black">
            {mode === "register" ? "Create your account" : "Welcome back"}
          </h2>
          <p className="mt-1 text-xs leading-5 text-white/45">
            Your account is verified by the Pulse server, not by this device.
          </p>

          <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-4">
            <label className="block text-xs font-semibold text-white/65">
              Email
              <input
                type="email"
                autoComplete="email"
                required
                maxLength={180}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none focus:border-cyan-300/40"
                placeholder="you@example.com"
              />
            </label>
            <label className="block text-xs font-semibold text-white/65">
              Password
              <input
                type="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                required
                minLength={mode === "register" ? 12 : undefined}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none focus:border-cyan-300/40"
                placeholder={mode === "register" ? "12 or more characters" : "Your password"}
              />
            </label>

            {message && (
              <p role="alert" className="rounded-xl bg-red-400/10 px-3 py-2 text-xs leading-5 text-red-200">
                {message}
              </p>
            )}

            <button
              disabled={isLoading}
              type="submit"
              className="min-h-12 w-full rounded-xl bg-gradient-to-r from-cyan-300 to-emerald-300 text-sm font-black text-slate-950 disabled:opacity-50"
            >
              {isLoading ? "Connecting securely..." :
                mode === "register" ? "Create account" : "Sign in"}
            </button>
          </form>

          <button
            type="button"
            className="mt-5 w-full text-center text-xs font-bold text-cyan-200/80 hover:text-cyan-100"
            onClick={() => {
              setMode((current) => current === "login" ? "register" : "login");
              setPassword("");
              setMessage(null);
            }}
          >
            {mode === "login" ? "New to Pulse? Create an account" : "Already registered? Sign in"}
          </button>
        </div>
        <p className="mt-4 text-center text-[11px] leading-5 text-white/35">
          Location is requested only when you use journey planning or tracking.
        </p>
      </div>
    </main>
  );
};

export default AuthScreen;
