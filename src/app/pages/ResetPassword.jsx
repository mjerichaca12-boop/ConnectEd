import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertCircle, CheckCircle, Eye, EyeOff, Lock } from "lucide-react";
import { motion } from "motion/react";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";

const getPasswordIssues = (password) => {
  const value = String(password || "");
  const issues = [];
  if (value.length < 8) issues.push("At least 8 characters");
  if (!/[A-Z]/.test(value)) issues.push("At least 1 uppercase letter");
  if (!/[a-z]/.test(value)) issues.push("At least 1 lowercase letter");
  if (!/[0-9]/.test(value)) issues.push("At least 1 number");
  if (!/[^A-Za-z0-9]/.test(value)) issues.push("At least 1 special character");
  return issues;
};

function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const passwordIssues = useMemo(() => getPasswordIssues(newPassword), [newPassword]);

  useEffect(() => {
    let mounted = true;

    const initRecoverySession = async () => {
      if (!supabase) {
        if (!mounted) return;
        setErrorMessage("Auth service is not configured. Please contact support.");
        setCheckingSession(false);
        return;
      }

      try {
        const hash = String(window.location.hash || "").replace(/^#/, "");
        const hashParams = new URLSearchParams(hash);
        const type = hashParams.get("type");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (type === "recovery" && accessToken && refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          if (setSessionError) throw setSessionError;

          // Remove recovery tokens from URL once session is established.
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        } else {
          const queryParams = new URLSearchParams(window.location.search);
          const code = queryParams.get("code");
          if (code) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) throw exchangeError;
          }
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!mounted) return;

        if (!sessionData?.session) {
          setErrorMessage("Reset link is invalid or expired. Please request a new password reset link.");
          setRecoveryReady(false);
        } else {
          setRecoveryReady(true);
        }
      } catch (err) {
        console.error("Reset password session error:", err);
        if (!mounted) return;
        setErrorMessage("Reset link is invalid or expired. Please request a new password reset link.");
        setRecoveryReady(false);
      } finally {
        if (mounted) setCheckingSession(false);
      }
    };

    initRecoverySession();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!recoveryReady) {
      setErrorMessage("Reset link is invalid or expired. Please request a new password reset link.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setErrorMessage("Please complete both password fields.");
      return;
    }

    if (passwordIssues.length > 0) {
      setErrorMessage("Password does not meet security requirements.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword.trim() });
      if (error) throw error;

      toast.success("Password updated successfully. Redirecting to login...");

      try {
        await supabase.auth.signOut();
      } catch {
        // Keep redirect flow even if sign out fails on an expired recovery session.
      }

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1400);
    } catch (err) {
      console.error("Reset password update error:", err);
      setErrorMessage("Unable to update password. The reset link may have expired. Please request a new reset email.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-gray-100"
      >
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Set New Password</h1>
          <p className="text-gray-500 text-sm">Use a strong password to secure your account.</p>
        </div>

        {checkingSession && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 text-sm">
            Verifying reset link...
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">New Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setErrorMessage("");
                }}
                className="w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                placeholder="Enter new password"
                autoComplete="new-password"
                disabled={checkingSession || !recoveryReady}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrorMessage("");
                }}
                className="w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                placeholder="Confirm new password"
                autoComplete="new-password"
                disabled={checkingSession || !recoveryReady}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600">
            <p className="font-semibold text-gray-700 mb-1">Password requirements:</p>
            <ul className="space-y-1">
              <li className={newPassword && !passwordIssues.includes("At least 8 characters") ? "text-emerald-700" : ""}>At least 8 characters</li>
              <li className={newPassword && !passwordIssues.includes("At least 1 uppercase letter") ? "text-emerald-700" : ""}>At least 1 uppercase letter</li>
              <li className={newPassword && !passwordIssues.includes("At least 1 lowercase letter") ? "text-emerald-700" : ""}>At least 1 lowercase letter</li>
              <li className={newPassword && !passwordIssues.includes("At least 1 number") ? "text-emerald-700" : ""}>At least 1 number</li>
              <li className={newPassword && !passwordIssues.includes("At least 1 special character") ? "text-emerald-700" : ""}>At least 1 special character</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={checkingSession || !recoveryReady || isSubmitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-emerald-200 transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Updating password..." : "Update Password"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="inline-flex items-center gap-2 text-emerald-600 text-sm font-semibold hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export { ResetPassword };
