// src/components/Auth.tsx
// Pulse Transit - Premium Authentication Component

import React, { useState, useEffect, useCallback, useRef } from "react";

// ======================================================
// TYPES
// ======================================================

interface User {
  email: string;
  name: string;
  preferredModes: string[];
  commuteTime: string;
  homeArea: string;
  workArea: string;
  isRoutine: boolean;
  avatar?: string;
  joinDate?: number;
  lastLogin?: number;
  totalTrips?: number;
  totalSpend?: number;
}

interface AuthProps {
  onLogin: (user: User) => void;
  onRegister?: (user: User) => void;
  enableBiometric?: boolean;
  enableDemoMode?: boolean;
}

interface FormErrors {
  email?: string;
  password?: string;
  name?: string;
  preferredModes?: string;
  commuteTime?: string;
  homeArea?: string;
  workArea?: string;
  general?: string;
}

// ======================================================
// CONSTANTS
// ======================================================

const TRANSPORT_OPTIONS = [
  { value: "Taxi", label: "🚖 Taxi", description: "Minibus taxis - most flexible" },
  { value: "Gautrain", label: "🚆 Gautrain", description: "Fastest, premium option" },
  { value: "Rea Vaya", label: "🚌 Rea Vaya", description: "Joburg BRT system" },
  { value: "A Re Yeng", label: "🚍 A Re Yeng", description: "Pretoria BRT" },
  { value: "Metrorail", label: "🚂 Metrorail", description: "Most affordable" }
] as const;

const COMMUTE_TIMES = [
  { value: "Morning (5am - 9am)", label: "🌅 Morning", timeRange: "5am - 9am" },
  { value: "Afternoon (3pm - 7pm)", label: "🌇 Afternoon", timeRange: "3pm - 7pm" },
  { value: "Flexible", label: "🕐 Flexible", timeRange: "Variable" }
] as const;

const AREA_SUGGESTIONS = [
  "Sandton", "Pretoria CBD", "Braamfontein", "Soweto", "Midrand",
  "Randburg", "Centurion", "Rosebank", "Fourways", "Parktown"
];

// ======================================================
// CUSTOM HOOKS
// ======================================================

const usePasswordStrength = (password: string) => {
  const [strength, setStrength] = useState(0);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let score = 0;
    let messages: string[] = [];

    if (password.length >= 8) {
      score += 1;
    } else {
      messages.push("At least 8 characters");
    }
    
    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      messages.push("One uppercase letter");
    }
    
    if (/[a-z]/.test(password)) {
      score += 1;
    }
    
    if (/[0-9]/.test(password)) {
      score += 1;
    } else {
      messages.push("One number");
    }
    
    if (/[^A-Za-z0-9]/.test(password)) {
      score += 1;
    } else {
      messages.push("One special character");
    }

    setStrength(score);
    setFeedback(messages.length ? `Need: ${messages.join(", ")}` : "Strong password!");
  }, [password]);

  const getColor = () => {
    if (strength <= 2) return "bg-red-500";
    if (strength <= 3) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getLabel = () => {
    if (strength <= 2) return "Weak";
    if (strength <= 3) return "Medium";
    return "Strong";
  };

  return { strength, feedback, getColor, getLabel };
};

// ======================================================
// SUB-COMPONENTS
// ======================================================

const PasswordStrengthIndicator: React.FC<{ password: string }> = ({ password }) => {
  const { strength, getColor, getLabel, feedback } = usePasswordStrength(password);
  
  if (!password) return null;
  
  return (
    <div className="mt-1 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              level <= strength ? getColor() : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between items-center">
        <span className={`text-xs ${strength <= 2 ? "text-red-400" : strength <= 3 ? "text-yellow-400" : "text-green-400"}`}>
          {getLabel()} password
        </span>
        {strength < 5 && password.length > 0 && (
          <span className="text-[10px] text-white/40">{feedback}</span>
        )}
      </div>
    </div>
  );
};

const TransportChip: React.FC<{
  mode: typeof TRANSPORT_OPTIONS[number];
  selected: boolean;
  onToggle: () => void;
}> = ({ mode, selected, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className={`
      relative px-4 py-3 rounded-xl text-left transition-all duration-200
      ${selected 
        ? "bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 border-cyan-400/50 shadow-lg shadow-cyan-500/10" 
        : "bg-white/5 border-white/10 hover:bg-white/10"
      }
      border-2 overflow-hidden group
    `}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className={`font-semibold ${selected ? "text-cyan-400" : "text-white"}`}>
          {mode.label}
        </p>
        <p className="text-[10px] text-white/40 mt-0.5">{mode.description}</p>
      </div>
      {selected && (
        <div className="w-5 h-5 rounded-full bg-cyan-400 flex items-center justify-center animate-scaleIn">
          <span className="text-black text-xs">✓</span>
        </div>
      )}
    </div>
  </button>
);

const FloatingLabelInput: React.FC<{
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string | undefined;
  error?: string | undefined;
  placeholder?: string | undefined;
  suggestions?: string[] | undefined;
}> = ({ label, value, onChange, type = "text", error, placeholder, suggestions = [] }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const hasValue = value.length > 0;
  const isFloating = isFocused || hasValue;
  
  const filteredSuggestions = suggestions.filter(s => 
    s.toLowerCase().includes(value.toLowerCase())
  );
  
  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => {
            setIsFocused(true);
            if (suggestions.length) setShowSuggestions(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          placeholder={placeholder || " "}
          className={`
            w-full h-14 px-4 pt-5 pb-1 rounded-xl outline-none transition-all duration-200
            bg-white/5 border-2 text-white
            ${error ? "border-red-500/50 focus:border-red-400" : "border-white/10 focus:border-cyan-400"}
          `}
        />
        <label
          className={`
            absolute left-4 transition-all duration-200 pointer-events-none
            ${isFloating 
              ? "top-1 text-[10px] text-cyan-400" 
              : "top-4 text-base text-white/40"
            }
          `}
        >
          {label}
        </label>
      </div>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-black/95 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden animate-fadeIn">
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                onChange({ target: { value: suggestion } } as any);
                setShowSuggestions(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-white/70 hover:bg-white/10 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ======================================================
// MAIN COMPONENT
// ======================================================

export const AuthView: React.FC<AuthProps> = ({ 
  onLogin, 
  onRegister,
  enableBiometric = false,
  enableDemoMode = true
}) => {
  // State
  const [isRegister, setIsRegister] = useState(false);
  const [currentStep, setCurrentStep] = useState<"credentials" | "profile">("credentials");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  
  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [preferredModes, setPreferredModes] = useState<string[]>([]);
  const [commuteTime, setCommuteTime] = useState("");
  const [homeArea, setHomeArea] = useState("");
  const [workArea, setWorkArea] = useState("");
  const [isRoutine, setIsRoutine] = useState(true);

  // ======================================================
  // VALIDATION
  // ======================================================
  
  const validateCredentials = useCallback((): boolean => {
    const errors: FormErrors = {};
    
    if (!email) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = "Please enter a valid email address";
    }
    
    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
    
    if (isRegister && password !== confirmPassword) {
      errors.password = "Passwords do not match";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [email, password, confirmPassword, isRegister]);

  const validateProfile = useCallback((): boolean => {
    const errors: FormErrors = {};
    
    if (!name) errors.name = "Name is required";
    if (!preferredModes.length) errors.preferredModes = "Select at least one transport mode";
    if (!commuteTime) errors.commuteTime = "Select your commute time";
    if (!homeArea) errors.homeArea = "Enter your starting area";
    if (!workArea) errors.workArea = "Enter your destination area";
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [name, preferredModes, commuteTime, homeArea, workArea]);

  // ======================================================
  // HANDLERS - FIXED: No more setting undefined
  // ======================================================
  
  const toggleMode = useCallback((mode: string) => {
    setPreferredModes(prev =>
      prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode]
    );
    // Clear error by removing the property entirely
    setFormErrors(prev => {
      const { preferredModes, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleContinue = useCallback(() => {
    if (validateCredentials()) {
      setCurrentStep("profile");
    }
  }, [validateCredentials]);

  const handleBack = useCallback(() => {
    setCurrentStep("credentials");
    setFormErrors({});
  }, []);

  const clearFieldError = useCallback((fieldName: keyof FormErrors) => {
    setFormErrors(prev => {
      const { [fieldName]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    clearFieldError('email');
  }, [clearFieldError]);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    clearFieldError('password');
  }, [clearFieldError]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    clearFieldError('name');
  }, [clearFieldError]);

  const handleHomeAreaChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHomeArea(e.target.value);
    clearFieldError('homeArea');
  }, [clearFieldError]);

  const handleWorkAreaChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setWorkArea(e.target.value);
    clearFieldError('workArea');
  }, [clearFieldError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (currentStep === "credentials" && isRegister) {
      handleContinue();
      return;
    }
    
    if (isRegister && !validateProfile()) return;
    if (!isRegister && !validateCredentials()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const user: User = {
        email,
        name: name || email.split("@")[0],
        preferredModes,
        commuteTime,
        homeArea,
        workArea,
        isRoutine,
        joinDate: Date.now(),
        lastLogin: Date.now(),
        totalTrips: 0,
        totalSpend: 0
      };
      
      localStorage.setItem(`pulse_user_${email}`, JSON.stringify(user));
      localStorage.setItem("pulse_current_user", email);
      
      onLogin(user);
      onRegister?.(user);
      
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = useCallback(() => {
    const demoUser: User = {
      email: "demo@pulsetransit.co.za",
      name: "Demo User",
      preferredModes: ["Taxi", "Gautrain"],
      commuteTime: "Morning (5am - 9am)",
      homeArea: "Soweto",
      workArea: "Sandton",
      isRoutine: true,
      joinDate: Date.now(),
      lastLogin: Date.now(),
      totalTrips: 12,
      totalSpend: 450
    };
    onLogin(demoUser);
  }, [onLogin]);

  // ======================================================
  // RENDER
  // ======================================================
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo & Branding */}
        <div className="text-center mb-8 animate-fadeIn">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-r from-cyan-500 to-emerald-500 shadow-xl shadow-cyan-500/20 mb-4">
            <span className="text-4xl">🚀</span>
          </div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Pulse Transit
          </h1>
          <p className="text-white/40 text-sm mt-2">
            {isRegister ? "Create your account" : "Welcome back, commuter"}
          </p>
        </div>

        {/* Progress Steps (Register only) */}
        {isRegister && (
          <div className="flex gap-2 mb-6">
            {["credentials", "profile"].map((step, _idx) => (
              <div key={step} className="flex-1">
                <div
                  className={`h-1 rounded-full transition-all duration-300 ${
                    currentStep === step
                      ? "bg-gradient-to-r from-cyan-500 to-emerald-500"
                      : currentStep === "profile" && step === "credentials"
                      ? "bg-emerald-500/50"
                      : "bg-white/10"
                  }`}
                />
                <p className="text-[10px] text-white/40 mt-1 text-center">
                  {step === "credentials" ? "Account" : "Profile"}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* CREDENTIALS STEP */}
          {(currentStep === "credentials" || !isRegister) && (
            <div className="space-y-4 animate-fadeIn">
              <FloatingLabelInput
                label="Email address"
                type="email"
                value={email}
                onChange={handleEmailChange}
                error={formErrors.email}
              />

              <FloatingLabelInput
                label="Password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                error={formErrors.password}
              />
              
              {password && <PasswordStrengthIndicator password={password} />}

              {isRegister && (
                <FloatingLabelInput
                  label="Confirm password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              )}
            </div>
          )}

          {/* PROFILE STEP (Register only) */}
          {isRegister && currentStep === "profile" && (
            <div className="space-y-4 animate-fadeIn">
              <FloatingLabelInput
                label="Full name"
                value={name}
                onChange={handleNameChange}
                error={formErrors.name}
              />

              <div>
                <label className="text-sm text-white/40 mb-2 block">
                  Preferred transport 🚆
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {TRANSPORT_OPTIONS.map((mode) => (
                    <TransportChip
                      key={mode.value}
                      mode={mode}
                      selected={preferredModes.includes(mode.value)}
                      onToggle={() => toggleMode(mode.value)}
                    />
                  ))}
                </div>
                {formErrors.preferredModes && (
                  <p className="text-red-400 text-xs mt-1">{formErrors.preferredModes}</p>
                )}
              </div>

              <div>
                <label className="text-sm text-white/40 mb-2 block">
                  Commute time ⏰
                </label>
                <div className="flex gap-2 flex-wrap">
                  {COMMUTE_TIMES.map((time) => (
                    <button
                      key={time.value}
                      type="button"
                      onClick={() => {
                        setCommuteTime(time.value);
                        clearFieldError('commuteTime');
                      }}
                      className={`px-4 py-2 rounded-xl text-sm transition-all ${
                        commuteTime === time.value
                          ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-white"
                          : "bg-white/5 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      {time.label}
                    </button>
                  ))}
                </div>
                {formErrors.commuteTime && (
                  <p className="text-red-400 text-xs mt-1">{formErrors.commuteTime}</p>
                )}
              </div>

              <FloatingLabelInput
                label="Starting area"
                value={homeArea}
                onChange={handleHomeAreaChange}
                placeholder="e.g., Soweto, Pretoria CBD"
                suggestions={AREA_SUGGESTIONS}
                error={formErrors.homeArea}
              />

              <FloatingLabelInput
                label="Destination area"
                value={workArea}
                onChange={handleWorkAreaChange}
                placeholder="e.g., Sandton, Midrand"
                suggestions={AREA_SUGGESTIONS}
                error={formErrors.workArea}
              />

              <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRoutine}
                  onChange={() => setIsRoutine(!isRoutine)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 checked:bg-cyan-500"
                />
                I use the same route most days
              </label>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 animate-shake">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="space-y-3">
            {isRegister && currentStep === "profile" && (
              <button
                type="button"
                onClick={handleBack}
                className="w-full h-12 rounded-xl bg-white/5 text-white/70 font-medium hover:bg-white/10 transition-all"
              >
                ← Back
              </button>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className={`
                w-full h-14 rounded-xl font-bold text-white transition-all duration-200
                bg-gradient-to-r from-cyan-500 to-emerald-500
                hover:shadow-lg hover:shadow-cyan-500/25 active:scale-98
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Please wait...</span>
                </div>
              ) : isRegister && currentStep === "credentials" ? (
                "Continue →"
              ) : isRegister ? (
                "Create Account 🎉"
              ) : (
                "Login →"
              )}
            </button>
          </div>
        </form>

        {/* Toggle Login/Register */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setCurrentStep("credentials");
              setFormErrors({});
              setError(null);
            }}
            className="text-white/40 text-sm hover:text-white transition-colors"
          >
            {isRegister ? "Already have an account? Sign in" : "New user? Create account"}
          </button>
        </div>

        {/* Demo Mode */}
        {enableDemoMode && !isRegister && (
          <div className="mt-4 text-center">
            <button
              onClick={handleDemoLogin}
              className="text-xs text-white/30 hover:text-white/50 transition-colors"
            >
              Try Demo Mode
            </button>
          </div>
        )}

        {/* Biometric Ready Badge */}
        {enableBiometric && (
          <div className="mt-6 flex justify-center">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5">
              <span className="text-xs text-white/40">🔒 Biometric ready</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};