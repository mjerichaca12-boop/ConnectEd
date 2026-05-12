import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
function SignUp() {
  const [formData, setFormData] = useState({
    usernameOrEmail: "",
    password: "",
    confirmPassword: "",
    agreedToTerms: false
  });
  const [errors, setErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleError, setGoogleError] = useState("");
  const navigate = useNavigate();
  const calculatePasswordStrength = (password) => {
    if (!password) return "";
    if (password.length < 6) return "weak";
    if (password.length < 10) return "medium";
    if (password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      return "strong";
    }
    return "medium";
  };
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    const checked = e.target.checked;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value
    });
    if (name === "password") {
      setPasswordStrength(calculatePasswordStrength(value));
    }
    setErrors({ ...errors, [name]: "" });
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.usernameOrEmail.trim()) newErrors.usernameOrEmail = "Username or email is required";
    if (!formData.password) newErrors.password = "Password is required";
    if (formData.password.length < 6) newErrors.password = "Password must be at least 6 characters";
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    if (!formData.agreedToTerms) {
      newErrors.agreedToTerms = "You must agree to the terms and privacy policy";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const redirectToDashboard = (role) => {
    if (role === "admin") {
      navigate("/admin/dashboard");
    } else if (role === "teacher") {
      navigate("/teacher/dashboard");
    } else {
      navigate("/dashboard");
    }
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    setSuccessMessage("");
    setTimeout(() => {
      // In a real app, this would be determined by a role selector or email domain
      // For now, let's assume if it contains 'teacher' it's a teacher, otherwise student
      const detectedRole = formData.usernameOrEmail.toLowerCase().includes("teacher") ? "teacher" : "student";
      const userData = {
        name: formData.usernameOrEmail,
        email: formData.usernameOrEmail,
        role: detectedRole
      };
      localStorage.setItem("currentUser", JSON.stringify(userData));
      setSuccessMessage(`Account created successfully for ${formData.usernameOrEmail}!`);
      setLoading(false);
      setTimeout(() => {
        redirectToDashboard(detectedRole);
      }, 1500);
    }, 1500);
  };
  const handleGoogleNext = () => {
    if (!googleEmail.trim()) {
      setGoogleError("Enter an email or phone number");
      return;
    }
    if (!googleEmail.includes("@")) {
      setGoogleError("Enter a valid email address");
      return;
    }
    const detectedRole = googleEmail.toLowerCase().includes("teacher") ? "teacher" : "student";
    const googleUser = {
      name: googleEmail.split("@")[0],
      email: googleEmail,
      role: detectedRole
    };
    localStorage.setItem("currentUser", JSON.stringify(googleUser));
    setShowGoogleModal(false);
    setGoogleEmail("");
    setGoogleError("");
    redirectToDashboard(detectedRole);
  };
  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case "weak":
        return "bg-red-500";
      case "medium":
        return "bg-blue-500";
      case "strong":
        return "bg-emerald-500";
      default:
        return "bg-gray-300";
    }
  };
  const getPasswordStrengthWidth = () => {
    switch (passwordStrength) {
      case "weak":
        return "w-1/3";
      case "medium":
        return "w-2/3";
      case "strong":
        return "w-full";
      default:
        return "w-0";
    }
  };
  const GoogleLogo = () => <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>;
  return <div className="min-h-screen bg-gray-50">
      <div className="w-full py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            {
    /* LEFT COLUMN */
  }
            <div className="w-full flex flex-col justify-start">
              <button
    type="button"
    onClick={() => navigate("/")}
    className="mb-6 inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
  >
                <ArrowLeft className="w-4 h-4" />
                Back to Landing Page
              </button>

              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Create your ConnectEd account
              </h1>

              <p className="text-lg text-gray-600 leading-relaxed mb-8">
                Join thousands of students and teachers using ConnectEd.
                Get instant access to academic records, communication tools, and school updatesâ€”all in one unified platform designed for your educational journey.
              </p>

              <div className="relative h-64 hidden md:block">
                <div className="absolute top-4 left-8 w-28 h-28 bg-emerald-100 rounded-2xl rotate-12 opacity-70" />
                <div className="absolute top-20 left-32 w-36 h-36 bg-emerald-200 rounded-2xl -rotate-6 opacity-50" />
                <div className="absolute bottom-8 left-16 w-24 h-24 bg-emerald-300 rounded-2xl rotate-45 opacity-60" />
                <div className="absolute top-32 right-12 w-16 h-16 bg-teal-200 rounded-full opacity-40" />
              </div>
            </div>

            {
    /* RIGHT COLUMN - Sign Up Card */
  }
            <div className="w-full flex justify-center">
              <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-gray-100">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">
                  Create Account
                </h2>

                {successMessage && <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-emerald-600 text-sm">{successMessage}</p>
                  </div>}

                <div className="flex flex-col gap-2 mb-4">
                  <button
    type="button"
    onClick={() => setShowGoogleModal(true)}
    className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
  >
                    <GoogleLogo />
                    Connect with Google account
                  </button>
                  <button
    type="button"
    onClick={() => navigate("/login")}
    className="w-full flex items-center justify-center gap-2 text-emerald-600 hover:text-emerald-700 text-sm font-medium cursor-pointer"
  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Log in Page
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">

                  {
    /* Username / Email */
  }
                  <div>
                    <label htmlFor="usernameOrEmail" className="block text-sm font-medium text-gray-700 mb-2">
                      Username / Email *
                    </label>
                    <input
    type="text"
    id="usernameOrEmail"
    name="usernameOrEmail"
    value={formData.usernameOrEmail}
    onChange={handleInputChange}
    placeholder="Enter your username or email"
    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${errors.usernameOrEmail ? "border-red-500" : "border-gray-300"}`}
  />
                    {errors.usernameOrEmail && <p className="text-red-500 text-sm mt-1">{errors.usernameOrEmail}</p>}
                  </div>

                  {
    /* Password */
  }
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                      Password *
                    </label>
                    <input
    type="password"
    id="password"
    name="password"
    value={formData.password}
    onChange={handleInputChange}
    placeholder="Create a password"
    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${errors.password ? "border-red-500" : "border-gray-300"}`}
  />
                    {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}

                    {formData.password && <div className="mt-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
    className={`h-full transition-all duration-300 ${getPasswordStrengthColor()} ${getPasswordStrengthWidth()}`}
  />
                          </div>
                          <span className="text-xs text-gray-600 capitalize">{passwordStrength}</span>
                        </div>
                      </div>}
                  </div>

                  {
    /* Confirm Password */
  }
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm Password *
                    </label>
                    <input
    type="password"
    id="confirmPassword"
    name="confirmPassword"
    value={formData.confirmPassword}
    onChange={handleInputChange}
    placeholder="Confirm your password"
    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${errors.confirmPassword ? "border-red-500" : "border-gray-300"}`}
  />
                    {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
                  </div>

                  {
    /* Terms Checkbox */
  }
                  <div>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
    type="checkbox"
    name="agreedToTerms"
    checked={formData.agreedToTerms}
    onChange={handleInputChange}
    className="mt-1 w-4 h-4 border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
  />
                      <span className="text-sm text-gray-700">
                        I agree to the{" "}
                        <Link to="/terms-and-privacy" className="text-emerald-600 hover:text-emerald-700 font-medium hover:underline">
                          Terms and Privacy Policy
                        </Link>
                      </span>
                    </label>
                    {errors.agreedToTerms && <p className="text-red-500 text-sm mt-1">{errors.agreedToTerms}</p>}
                  </div>

                  {
    /* Create Account Button */
  }
                  <button
    type="submit"
    disabled={loading}
    className="w-full bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-all disabled:bg-emerald-400 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30"
  >
                    {loading ? "Creating Account..." : "Create Account"}
                  </button>

                  {
    /* Login Link */
  }
                  <div className="text-center pt-2">
                    <p className="text-gray-600 text-sm">
                      Already have an account?{" "}
                      <Link to="/login" className="text-emerald-600 hover:text-emerald-700 font-medium hover:underline">
                        Login
                      </Link>
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {
    /* Google Sign-in Modal */
  }
      {showGoogleModal && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
            {
    /* Google Logo */
  }
            <div className="flex justify-center mb-6">
              <svg className="w-12 h-12" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </div>

            <h3 className="text-xl font-bold text-gray-900 text-center mb-1">Sign in with Google</h3>
            <p className="text-sm text-gray-500 text-center mb-6">to continue to ConnectEd</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email or phone</label>
                <input
    type="email"
    value={googleEmail}
    onChange={(e) => {
      setGoogleEmail(e.target.value);
      setGoogleError("");
    }}
    onKeyDown={(e) => e.key === "Enter" && handleGoogleNext()}
    placeholder="Enter your Gmail address"
    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${googleError ? "border-red-500" : "border-gray-300"}`}
    autoFocus
  />
                {googleError && <p className="text-red-500 text-sm mt-1">{googleError}</p>}
              </div>

              <p className="text-xs text-gray-500">
                Not your computer? Use Guest mode to sign in privately.
              </p>

              <div className="flex items-center justify-between pt-2">
                <button
    type="button"
    onClick={() => {
      setShowGoogleModal(false);
      setGoogleEmail("");
      setGoogleError("");
    }}
    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
  >
                  Cancel
                </button>
                <button
    type="button"
    onClick={handleGoogleNext}
    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
  >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>}
    </div>;
}
export {
  SignUp
};
