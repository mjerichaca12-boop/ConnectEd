import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Key, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";

function SetPassword() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading, form, success, error
  const [message, setMessage] = useState("Validating your invitation...");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const tokenFromUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search || "");
    return String(params.get("token") || "").trim();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const validateToken = async () => {
      if (!tokenFromUrl) {
        if (isMounted) {
          setStatus("error");
          setMessage("Missing invitation token. Please check your email for the invitation link.");
        }
        return;
      }

      setToken(tokenFromUrl);

      // Basic token format validation (should be hex string)
      if (!/^[a-f0-9]{64}$/.test(tokenFromUrl)) {
        if (isMounted) {
          setStatus("error");
          setMessage("Invalid invitation token format. Please check your email for the correct link.");
        }
        return;
      }

      if (isMounted) {
        setStatus("form");
        setMessage("");
      }
    };

    validateToken();

    return () => {
      isMounted = false;
    };
  }, [tokenFromUrl]);

  const validatePassword = (pwd) => {
    if (!pwd) return "Password is required.";
    if (pwd.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(pwd)) return "Password must contain at least one uppercase letter.";
    if (!/[a-z]/.test(pwd)) return "Password must contain at least one lowercase letter.";
    if (!/[0-9]/.test(pwd)) return "Password must contain at least one number.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ""}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || ""
        },
        body: JSON.stringify({
          token,
          password
        })
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        setError(data?.message || "Failed to create account.");
        setLoading(false);
        return;
      }

      setStatus("success");
      setMessage(data?.message || "Your account has been created successfully!");
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while setting your password.");
      setLoading(false);
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg bg-gray-900 border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Account Created!</h1>
              <p className="text-sm text-gray-400 mt-1">{message}</p>
            </div>
          </div>

          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <p className="text-emerald-300 text-sm">
              Your account is ready. Redirecting you to login...
            </p>
          </div>

          <Link
            to="/login"
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg bg-gray-900 border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Invalid Invitation</h1>
              <p className="text-sm text-gray-400 mt-1">{message}</p>
            </div>
          </div>

          <div className="space-y-3">
            <Link
              to="/request-access"
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-semibold"
            >
              Request Access
            </Link>
            <Link
              to="/login"
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg bg-gray-900 border border-white/10 rounded-2xl p-8 shadow-2xl">
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-emerald-300 text-sm transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to login
        </button>

        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <Key className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Set Your Password</h1>
            <p className="text-sm text-gray-400 mt-1">Create a secure password for your ConnectEd account</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="Create a strong password"
                className="w-full bg-gray-950 border border-white/10 text-white placeholder-gray-600 pl-11 pr-12 py-3 rounded-xl focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Must be at least 8 characters with uppercase, lowercase, and numbers.
            </p>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
                placeholder="Confirm your password"
                className="w-full bg-gray-950 border border-white/10 text-white placeholder-gray-600 pl-11 pr-12 py-3 rounded-xl focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-700 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-sm mt-6"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating Account...
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <p className="text-gray-600 text-xs text-center mt-6 pt-6 border-t border-white/10">
          Don't have an invitation? <Link to="/request-access" className="text-emerald-400 hover:text-emerald-300 font-semibold">Request access here</Link>
        </p>
      </div>
    </div>
  );
}

export { SetPassword };
