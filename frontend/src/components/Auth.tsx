// components/Auth.tsx

import React, { useState } from "react";

// ---------------- TYPES ----------------
interface User {
  email: string;
  name: string;

  preferredModes: string[];
  commuteTime: string;

  homeArea: string;
  workArea: string;
  isRoutine: boolean;
}

interface AuthProps {
  onLogin: (user: User) => void;
}

// ---------------- CONSTANTS ----------------
const TRANSPORT_OPTIONS = [
  "Taxi",
  "Gautrain",
  "Rea Vaya",
  "A Re Yeng",
  "Metrorail"
];

const COMMUTE_TIMES = [
  "Morning (5am - 9am)",
  "Afternoon (3pm - 7pm)",
  "Flexible"
];

// ---------------- COMPONENT ----------------
export const AuthView: React.FC<AuthProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  // 🔥 KYC
  const [preferredModes, setPreferredModes] = useState<string[]>([]);
  const [commuteTime, setCommuteTime] = useState("");
  const [homeArea, setHomeArea] = useState("");
  const [workArea, setWorkArea] = useState("");
  const [isRoutine, setIsRoutine] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------- VALIDATION ----------------
  const validate = (): string | null => {
    if (!email || !password) return "Fill in all fields";
    if (!/\S+@\S+\.\S+/.test(email)) return "Invalid email";
    if (password.length < 6) return "Password too short";

    if (isRegister) {
      if (!name) return "Enter your name";
      if (!preferredModes.length) return "Select transport";
      if (!commuteTime) return "Select commute time";
      if (!homeArea) return "Enter starting area";
      if (!workArea) return "Enter destination area";
    }

    return null;
  };

  // ---------------- TOGGLE MODE ----------------
  const toggleMode = (mode: string) => {
    setPreferredModes((prev) =>
      prev.includes(mode)
        ? prev.filter((m) => m !== mode)
        : [...prev, mode]
    );
  };

  // ---------------- SUBMIT ----------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) return setError(validationError);

    try {
      setLoading(true);
      await new Promise((res) => setTimeout(res, 800));

      const user: User = {
        email,
        name: name || email.split("@")[0],
        preferredModes,
        commuteTime,
        homeArea,
        workArea,
        isRoutine
      };

      localStorage.setItem(
        `mzansi_user_${email}`,
        JSON.stringify(user)
      );

      onLogin(user);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- UI ----------------
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8">

        <div className="text-center">
          <h1 className="text-4xl font-black text-white">
            MzansiPass
          </h1>
          <p className="text-white/40 text-sm mt-2">
            Smarter commuting starts here
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {isRegister && (
            <input
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          )}

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />

          {isRegister && (
            <>
              {/* TRANSPORT */}
              <div className="flex flex-wrap gap-2">
                {TRANSPORT_OPTIONS.map((mode) => (
                  <button
                    type="button"
                    key={mode}
                    onClick={() => toggleMode(mode)}
                    className={`px-3 py-2 rounded-xl text-xs ${
                      preferredModes.includes(mode)
                        ? "bg-blue-500"
                        : "bg-white/5"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {/* COMMUTE */}
              <select
                value={commuteTime}
                onChange={(e) => setCommuteTime(e.target.value)}
                className="input"
              >
                <option value="">Select commute time</option>
                {COMMUTE_TIMES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>

              {/* 🔥 ROUTE CONTEXT */}
              <input
                placeholder="Where do you usually start? (e.g. Soweto)"
                value={homeArea}
                onChange={(e) => setHomeArea(e.target.value)}
                className="input"
              />

              <input
                placeholder="Where do you usually go? (e.g. Sandton)"
                value={workArea}
                onChange={(e) => setWorkArea(e.target.value)}
                className="input"
              />

              {/* ROUTINE */}
              <label className="flex items-center gap-2 text-xs text-white/60">
                <input
                  type="checkbox"
                  checked={isRoutine}
                  onChange={() => setIsRoutine(!isRoutine)}
                />
                I use the same route most days
              </label>
            </>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button className="btn-primary w-full h-14">
            {isRegister ? "Create Account" : "Login"}
          </button>
        </form>

        <p className="text-center text-white/40 text-sm">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-white"
          >
            {isRegister ? "Sign in" : "Register"}
          </button>
        </p>
      </div>
    </div>
  );
};