import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Lock, Eye, EyeOff, Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function ChangePassword() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const rawUser = localStorage.getItem("currentUser");
    if (!rawUser) {
      navigate("/login");
      return;
    }
    const user = JSON.parse(rawUser);
    if (!user.must_change_password) {
      // If they somehow got here but don't need to change password
      redirectBasedOnRole(user.role);
    } else {
      setCurrentUser(user);
    }
  }, [navigate]);

  const redirectBasedOnRole = (role) => {
    if (role === "admin") navigate("/admin/dashboard");
    else if (role === "teacher") navigate("/teacher/dashboard");
    else if (role === "student") navigate("/student/dashboard"); // Students only on mobile, but just in case
    else navigate("/login");
  };

  const validatePassword = (password) => {
    if (password.length < 8) return "Password must be at least 8 characters long.";
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return "Password must contain at least one letter and one number.";
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setError("");

    if (!currentPassword) {
      setError("Please enter your current temporary password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    const validationError = validatePassword(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      // Re-authenticate to ensure they know the current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: currentPassword
      });

      if (signInError) {
        throw new Error("Invalid current password.");
      }

      // Update password
      const { error: updateAuthError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateAuthError) {
        throw new Error(updateAuthError.message || "Failed to update password.");
      }

      // Update profiles table
      const { error: dbError } = await supabase
        .from("profiles")
        .update({
          must_change_password: false,
          is_verified: true
        })
        .eq("id", currentUser.id);

      if (dbError) {
        throw new Error("Failed to update profile status.");
      }

      // Update local storage
      const updatedUser = { ...currentUser, must_change_password: false };
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
      
      toast.success("Password changed successfully!");
      
      // Redirect
      redirectBasedOnRole(updatedUser.role);

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-green-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-gray-100">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-blue-600" />
            </div>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
          Secure Your Account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 max-w-sm mx-auto">
          For your security, you must change your temporary password before accessing your dashboard.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white/80 backdrop-blur-xl py-8 px-4 shadow-2xl sm:rounded-3xl sm:px-10 border border-white">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                <p className="text-sm text-red-800 font-medium">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Current Temporary Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-gray-50 focus:bg-white transition-all text-sm placeholder:text-gray-400"
                  placeholder="Enter your temporary password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showCurrent ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                New Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-gray-50 focus:bg-white transition-all text-sm placeholder:text-gray-400"
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
                  <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-gray-50 focus:bg-white transition-all text-sm placeholder:text-gray-400"
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                  Updating Password...
                </>
              ) : (
                "Change Password & Continue"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
