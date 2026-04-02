import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Lock, User } from "lucide-react";

/* DepEd brand colors: Green (DasmariÃ±as) + Blue + Red */
const GoogleLogo = () => (
  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

function Login() {
  const [formData, setFormData] = useState({ usernameOrEmail: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleError, setGoogleError] = useState("");
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.usernameOrEmail || !formData.password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem("currentUser", JSON.stringify({
        name: formData.usernameOrEmail.split("@")[0] || "Teacher",
        email: formData.usernameOrEmail,
        role: "teacher",
      }));
      setLoading(false);
      navigate("/teacher/dashboard");
    }, 1400);
  };

  const handleGoogleNext = () => {
    if (!googleEmail.trim()) { setGoogleError("Enter an email address"); return; }
    if (!googleEmail.includes("@")) { setGoogleError("Enter a valid email address"); return; }
    localStorage.setItem("currentUser", JSON.stringify({
      name: googleEmail.split("@")[0],
      email: googleEmail,
      role: "teacher",
    }));
    setShowGoogleModal(false);
    navigate("/teacher/dashboard");
  };

  const highlights = [
    { color: "bg-emerald-500", label: "DasmariÃ±as City Schools Division" },
    { color: "bg-blue-600",   label: "Department of Education (DepEd)" },
    { color: "bg-red-600",    label: "Public School Management System" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex">

      {/* â”€â”€ LEFT PANEL â”€â”€ */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] relative overflow-hidden p-12">
        {/* DepEd tri-color top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 flex">
          <div className="flex-1 bg-emerald-500" />
          <div className="flex-1 bg-blue-600" />
          <div className="flex-1 bg-red-600" />
        </div>

        {/* Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-emerald-500/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-0 w-[300px] h-[300px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

        {/* Top */}
        <div className="relative">
          <button onClick={() => navigate("/")} className="inline-flex items-center gap-2 text-gray-500 hover:text-emerald-400 text-sm font-medium transition-colors mb-16">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </button>

        {/* Brand lockup */}
          <div className="flex items-center gap-3 mb-2">
            <div>
              <p className="text-white font-extrabold text-2xl tracking-tight leading-none">
                Connect<span className="text-emerald-400">Ed</span>
              </p>
              <p className="text-gray-500 text-xs font-medium mt-0.5">Teacher Portal Â· Web Platform</p>
            </div>
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mt-10 mb-4 tracking-tight">
            Welcome back,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-blue-400 to-red-400">
              Educator.
            </span>
          </h1>
          <p className="text-gray-400 text-base leading-relaxed max-w-md">
            Log in to manage your classes, record grades, track attendance, and stay connected with your students.
          </p>
        </div>

        {/* Bottom */}
        <div className="relative border-t border-white/8 pt-6">
          <p className="text-gray-600 text-xs">
            ConnectEd Â· Official School Management System Â· DasmariÃ±as, Cavite
          </p>
        </div>
      </div>

      {/* â”€â”€ RIGHT PANEL â”€â”€ */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 relative">
        {/* DepEd tri-color right accent */}
        <div className="absolute top-0 right-0 bottom-0 w-0.5 flex flex-col lg:flex">
          <div className="flex-1 bg-emerald-500/40" />
          <div className="flex-1 bg-blue-600/40" />
          <div className="flex-1 bg-red-600/40" />
        </div>

        <button onClick={() => navigate("/")} className="lg:hidden absolute top-6 left-6 inline-flex items-center gap-2 text-gray-500 hover:text-emerald-400 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Home
        </button>

        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10 justify-center">
            <span className="text-white font-extrabold text-xl">Connect<span className="text-emerald-400">Ed</span></span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-1">Sign in to your account</h2>
            <p className="text-gray-500 text-sm">Enter your credentials to continue</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Google Sign In */}
          <button
            type="button"
            onClick={() => { setShowGoogleModal(true); setGoogleEmail(""); setGoogleError(""); }}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-medium px-4 py-3 rounded-xl border border-gray-200 transition-all shadow-sm mb-5 text-sm"
          >
            <GoogleLogo />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-gray-600 text-xs font-medium">or sign in with credentials</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Username or Email</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  name="usernameOrEmail"
                  value={formData.usernameOrEmail}
                  onChange={handleInputChange}
                  placeholder="e.g. teacher@school.edu.ph"
                  autoComplete="username"
                  className="w-full bg-gray-900 border border-white/10 text-white placeholder-gray-600 pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Password</label>
                <Link to="/forgot-password" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">Forgot password?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full bg-gray-900 border border-white/10 text-white placeholder-gray-600 pl-11 pr-12 py-3 rounded-xl focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-700 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-sm mt-2"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...</>
              ) : "Sign In"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/8 text-center">
            {/* Tri-color dots */}
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <div className="w-2 h-2 rounded-full bg-red-500" />
            </div>
            <p className="text-gray-600 text-xs">ConnectEd Teacher Portal Â· Official Web Platform</p>
          </div>
        </div>
      </div>

      {/* â”€â”€ GOOGLE MODAL â”€â”€ */}
      {showGoogleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
            <div className="flex justify-center mb-6"><GoogleLogo /></div>
            <h3 className="text-xl font-bold text-gray-900 text-center mb-1">Sign in with Google</h3>
            <p className="text-sm text-gray-500 text-center mb-6">to continue to ConnectEd</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input
                  type="email"
                  value={googleEmail}
                  onChange={(e) => { setGoogleEmail(e.target.value); setGoogleError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleGoogleNext()}
                  placeholder="Enter your Gmail address"
                  autoFocus
                  className={`w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${googleError ? "border-red-400" : "border-gray-300"}`}
                />
                {googleError && <p className="text-red-500 text-xs mt-1">{googleError}</p>}
              </div>
              <div className="flex items-center justify-between pt-1">
                <button type="button" onClick={() => setShowGoogleModal(false)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Cancel</button>
                <button type="button" onClick={handleGoogleNext} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">Next</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { Login };
