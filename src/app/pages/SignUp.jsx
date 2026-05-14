import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase, supabaseAdmin } from "../lib/supabaseClient";

const generateUUID = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

const GoogleLogo = () => (
  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

function SignUp() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1280);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1280);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleManualSignUp = async (e) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setError("Please fill in all fields.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const db = supabaseAdmin || supabase;
      if (!db) {
        throw new Error("Database connection not configured.");
      }

      const normalizedEmail = formData.email.trim().toLowerCase();
      
      // Check if email already exists
      const { data: existing, error: checkError } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        setError("This email is already registered.");
        setLoading(false);
        return;
      }

      const payload = {
        id: generateUUID(),
        email: normalizedEmail,
        first_name: formData.firstName,
        last_name: formData.lastName,
        password: formData.password,
        role: "student",
        status: "Pending",
        created_at: new Date().toISOString(),
        subjects: []
      };

      const { error: insertError } = await db
        .from("profiles")
        .insert(payload);

      if (insertError) throw insertError;

      setSuccess("Registration request sent! Please wait for admin approval.");
      setFormData({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "" });
      
    } catch (err) {
      console.error("Sign-up Error:", err);
      setError(err.message || "Failed to submit registration. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    if (!supabase) {
      setError("Connection error: Supabase not configured.");
      return;
    }

    setLoading(true);
    setError("");

    localStorage.setItem("connected_signup_role", "teacher");

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/login`,
          queryParams: {
            prompt: "select_account"
          }
        }
      });

      if (oauthError) {
        throw oauthError;
      }
      
      // The browser will redirect to Google
    } catch (err) {
      console.error("Google Sign-Up Error:", err);
      setError("Connection error. Please check your internet and try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Left Content */}
            <div className="w-full flex flex-col justify-start">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="mb-8 inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Landing Page
              </button>
              
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Welcome to <span className="text-emerald-600">ConnectEd</span>
              </h1>
              <p className="text-lg text-gray-600 leading-relaxed mb-8 max-w-lg">
                The official portal for students and teachers of Dasmariñas City. 
                Experience seamless integration of grades, attendance, and communication 
                in one unified dashboard.
              </p>
              
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white" />
                  ))}
                </div>
                <span>Joined by over 10,000+ users citywide</span>
              </div>
            </div>

            {/* Right Card */}
            <div className="w-full flex justify-center">
              <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-md border border-gray-100">
                <div className="mb-10 text-center">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h2>
                  <p className="text-gray-500">Fast and secure access with Google</p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-red-600 text-sm font-medium">{error}</p>
                  </div>
                )}

                <div className="mb-8 flex items-center justify-center gap-2 py-2 px-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <span className="text-xl">{isMobile ? "🎓" : "👨‍🏫"}</span>
                  <span className="text-sm font-semibold text-gray-600">
                    Signing up as a <span className="text-emerald-600">{isMobile ? "Student" : "Teacher"}</span>
                  </span>
                </div>

                <div className="space-y-6">
                  {isMobile ? (
                    <form onSubmit={handleManualSignUp} className="space-y-4">
                      {success && (
                        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                          <p className="text-emerald-700 text-sm font-medium">{success}</p>
                          <button 
                            type="button"
                            onClick={() => navigate("/login")}
                            className="mt-2 text-emerald-600 font-bold hover:underline text-xs"
                          >
                            Go to Login
                          </button>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">First Name</label>
                          <input
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleInputChange}
                            placeholder="John"
                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Last Name</label>
                          <input
                            type="text"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleInputChange}
                            placeholder="Doe"
                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="student@example.com"
                          className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Password</label>
                          <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleInputChange}
                            placeholder="••••••••"
                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Confirm</label>
                          <input
                            type="password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleInputChange}
                            placeholder="••••••••"
                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 transition-all active:scale-[0.98] disabled:opacity-70 text-lg"
                      >
                        {loading ? "Submitting..." : "Send Request"}
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={handleGoogleSignUp}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-4 bg-white hover:bg-gray-50 text-gray-700 font-bold px-4 py-4 rounded-2xl border-2 border-emerald-500 transition-all shadow-md active:scale-[0.98] disabled:opacity-70 text-lg group"
                    >
                      <div className="group-hover:scale-110 transition-transform">
                        <GoogleLogo />
                      </div>
                      {loading ? "Connecting..." : "Continue with Google"}
                    </button>
                  )}

                  <div className="relative py-4 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-100"></div>
                    </div>
                    <span className="relative px-4 bg-white text-xs font-semibold text-gray-400 uppercase tracking-widest">
                      Secure Access
                    </span>
                  </div>

                  <div className="text-center">
                    <p className="text-gray-500 text-sm mb-4">Already have an account?</p>
                    <button
                      onClick={() => navigate("/login")}
                      className="w-full bg-gray-50 hover:bg-gray-100 text-emerald-600 font-bold py-3.5 rounded-2xl border border-gray-200 transition-all text-sm"
                    >
                      Log In to your Portal
                    </button>
                  </div>
                </div>

                <div className="mt-12 text-center">
                  <p className="text-[10px] text-gray-400 leading-relaxed uppercase tracking-widest font-bold">
                    Official DepEd Dasmariñas Platform
                  </p>
                  <div className="flex justify-center gap-1.5 mt-3">
                    <div className="w-1 h-1 rounded-full bg-emerald-400" />
                    <div className="w-1 h-1 rounded-full bg-blue-400" />
                    <div className="w-1 h-1 rounded-full bg-red-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { SignUp };
