import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, ShieldCheck, Check } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export function SecureAccount() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const rawUser = localStorage.getItem("currentUser");
    if (!rawUser) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      const parsedUser = JSON.parse(rawUser);
      if (parsedUser?.role !== "student") {
        navigate("/login", { replace: true });
        return;
      }
      
      if (!parsedUser?.must_change_password) {
        navigate("/dashboard", { replace: true });
        return;
      }
      
      setCurrentUser(parsedUser);
    } catch {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  // Validation checks
  const isMinLength = formData.newPassword.length >= 8;
  const hasLetterAndNumber = /[a-zA-Z]/.test(formData.newPassword) && /[0-9]/.test(formData.newPassword);
  const isPasswordValid = isMinLength && hasLetterAndNumber;

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (!isPasswordValid) {
      setError("New password does not meet all requirements.");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      setError("New password must be different from your temporary password.");
      return;
    }

    setLoading(true);

    try {
      // 1. Verify current temporary password by signing in again
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: formData.currentPassword
      });

      if (signInError) {
        setError("The current temporary password you entered is incorrect.");
        setLoading(false);
        return;
      }

      // 2. Update password in Supabase Auth
      const { error: updateAuthError } = await supabase.auth.updateUser({
        password: formData.newPassword
      });

      if (updateAuthError) {
        throw updateAuthError;
      }

      // 3. Update profiles table to set must_change_password = false
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", currentUser.id);

      if (profileError) {
        throw profileError;
      }

      // 4. Update stored currentUser session
      const updatedUser = { ...currentUser, must_change_password: false };
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
      
      setSuccess("Password changed successfully! Redirecting to dashboard...");
      
      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 1500);

    } catch (err) {
      console.error("Forced password change error:", err);
      setError(err.message || "An error occurred while changing your password.");
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      {/* Top Shield Logo */}
      <div className="mb-6 flex flex-col items-center">
        <div className="w-16 h-16 bg-white border border-gray-150 rounded-2xl shadow-sm flex items-center justify-center mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight text-center">Secure Your Account</h1>
        <p className="text-gray-500 text-sm max-w-sm text-center leading-relaxed">
          For your security, you must change your temporary password before accessing your dashboard.
        </p>
      </div>

      {/* Main card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Current Password */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
              Current Temporary Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showCurrentPassword ? "text" : "password"}
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleInputChange}
                className="w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-250 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm text-gray-800"
                placeholder="Enter your temporary password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showNewPassword ? "text" : "password"}
                name="newPassword"
                value={formData.newPassword}
                onChange={handleInputChange}
                className="w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-250 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm text-gray-800"
                placeholder="Minimum 8 characters, letters & numbers"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            {/* Dynamic requirements check */}
            <div className="mt-3 flex gap-4 text-xs">
              <span className={`flex items-center gap-1 font-medium ${isMinLength ? "text-green-600" : "text-gray-400"}`}>
                <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${isMinLength ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}>
                  {isMinLength && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
                8+ chars
              </span>
              <span className={`flex items-center gap-1 font-medium ${hasLetterAndNumber ? "text-green-600" : "text-gray-400"}`}>
                <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${hasLetterAndNumber ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}>
                  {hasLetterAndNumber && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
                Letter & Number
              </span>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-255 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm text-gray-800"
                placeholder="Re-enter your new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 mt-4 text-sm"
          >
            {loading ? "Saving changes..." : "Change Password & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
