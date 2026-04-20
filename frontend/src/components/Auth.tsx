// components/auth.tsx

import React, { useState } from "react";

// ---------------- TYPES ----------------
interface User {
  email: string;
  name: string;
}

interface AuthProps {
  onLogin: (user: User) => void;
}

// ---------------- COMPONENT ----------------
export const AuthView: React.FC<AuthProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------- VALIDATION ----------------
  const validate = (): string | null => {
    if (!email || !password) {
      return "Please fill in all fields";
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return "Enter a valid email address";
    }

    if (password.length < 6) {
      return "Password must be at least 6 characters";
    }

    return null;
  };

  // ---------------- SUBMIT ----------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);

      // 🔥 Simulate API call (replace later)
      await new Promise((res) => setTimeout(res, 800));

      const user: User = {
        email,
        name: email.split("@")[0],
      };

      onLogin(user);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- UI ----------------
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md space-y-10">

        {/* HEADER */}
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-emerald-400 rounded-3xl mx-auto flex items-center justify-center shadow-2xl mb-6">
            <span className="text-4xl">🇿🇦</span>
          </div>

          <h1 className="text-4xl font-black tracking-tight text-white">
            MzansiPass
          </h1>

          <p className="text-white/40 text-sm mt-2">
            Experience the future of mobility
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* INPUTS */}
          <div className="space-y-3">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/40 transition-all disabled:opacity-50"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/40 transition-all disabled:opacity-50"
            />
          </div>

          {/* ERROR */}
          {error && (
            <div className="text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-white text-black rounded-2xl font-bold text-lg active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading
              ? "Please wait..."
              : isRegister
              ? "CREATE ACCOUNT"
              : "LOG IN"}
          </button>
        </form>

        {/* TOGGLE */}
        <p className="text-center text-white/30 text-sm">
          {isRegister
            ? "Already have an account?"
            : "Don't have an account?"}{" "}
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-white font-semibold hover:underline"
          >
            {isRegister ? "Sign in" : "Register now"}
          </button>
        </p>
      </div>
    </div>
  );
};