import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";

export function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initPasswordResetSession = async () => {
      if (!supabase) {
        if (isMounted) {
          setError("Supabase client is not configured.");
          setSessionChecking(false);
        }
        return;
      }

      // 1. Check for PKCE code or hash error in URL
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));

      const pkceCode = searchParams.get("code");
      const hashError = hashParams.get("error_description") || searchParams.get("error_description");
      const errorCode = hashParams.get("error_code") || searchParams.get("error_code");

      if (hashError || errorCode) {
        if (isMounted) {
          setError(hashError || "The password reset link is invalid or has expired.");
          setHasValidSession(false);
          setSessionChecking(false);
        }
        return;
      }

      if (pkceCode) {
        try {
          console.log("[ResetPassword] Exchanging authorization code for session...");
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(pkceCode);
          if (exchangeErr) {
            console.warn("[ResetPassword] Code exchange warning:", exchangeErr.message);
          }
        } catch (e) {
          console.warn("[ResetPassword] Code exchange exception:", e);
        }
      }

      // 2. Check current Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session && isMounted) {
        console.log("[ResetPassword] Recovery session verified for user:", session.user?.email);
        setHasValidSession(true);
        setSessionChecking(false);
        return;
      }

      // 3. Listen for Supabase auth events (PASSWORD_RECOVERY, SIGNED_IN)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
        console.log("[ResetPassword] Auth state event:", event);
        if (isMounted && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || newSession)) {
          setHasValidSession(true);
          setSessionChecking(false);
        }
      });

      // 4. Timeout fallback if no session is established within 3.5 seconds
      const timer = setTimeout(async () => {
        if (!isMounted) return;
        const { data: { session: recheckSession } } = await supabase.auth.getSession();
        if (recheckSession) {
          setHasValidSession(true);
        } else {
          setHasValidSession(false);
          setError("Your password reset link is invalid or has expired. Please request a new link.");
        }
        setSessionChecking(false);
      }, 3500);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timer);
      };
    };

    initPasswordResetSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const validatePassword = (password) => {
    if (password.length < 8) return "Password must be at least 8 characters long.";
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return "Password must contain at least one letter and one number.";
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const validationError = validatePassword(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const trimmedPassword = newPassword.trim();
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: trimmedPassword
      });

      if (updateError) throw updateError;

      const updatedUser = updateData?.user;
      if (updatedUser?.id) {
        try {
          await supabase
            .from("profiles")
            .update({
              must_change_password: false,
              needs_password_change: false,
              force_password_change: false,
              last_password_reset: new Date().toISOString()
            })
            .eq("id", updatedUser.id);
        } catch (profErr) {
          console.warn("[ResetPassword] Profile update warning:", profErr);
        }
      }

      toast.success("Password updated successfully! Please log in with your new password.");
      await supabase.auth.signOut();
      localStorage.removeItem("currentUser");
      navigate("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
          Set New Password
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 max-w-sm mx-auto">
          Please enter your new password below.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-xl py-8 px-4 shadow-2xl sm:rounded-3xl sm:px-10 border border-white"
        >
          {sessionChecking ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="text-sm font-medium text-gray-600">Verifying password reset link...</p>
            </div>
          ) : !hasValidSession ? (
            <div className="space-y-6 text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-red-100 rounded-full text-red-600 mb-2">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Reset Link Expired or Invalid</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {error || "Your password reset link is invalid or has expired. Please request a new link."}
              </p>
              <div className="pt-2">
                <Link
                  to="/forgot-password"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-sm text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Request New Password Reset Link
                </Link>
              </div>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                  <p className="text-sm text-red-800 font-medium">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  New Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                  </div>
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-gray-50 focus:bg-white transition-all text-sm placeholder:text-gray-400"
                    placeholder="Minimum 8 characters, letters & numbers"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showNew ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
                <div className="mt-2 flex gap-2 text-xs">
                  <span className={`flex items-center gap-1 ${newPassword.length >= 8 ? "text-green-600" : "text-gray-400"}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> 8+ chars
                  </span>
                  <span className={`flex items-center gap-1 ${/[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword) ? "text-green-600" : "text-gray-400"}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Letter & Number
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                  </div>
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-gray-50 focus:bg-white transition-all text-sm placeholder:text-gray-400"
                    placeholder="Re-enter your new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showConfirm ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !newPassword || !confirmPassword}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Password"}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
