import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Lock, User, ShieldAlert, Monitor, Smartphone } from "lucide-react";
import { supabase, supabaseAdmin } from "../lib/supabaseClient";
import {
  STATIC_ADMIN_EMAIL,
  getStaticAdminSessionUser,
  normalizeEmail,
  validateStaticAdminCredentials
} from "../lib/staticAdminAuth";

const GoogleLogo = () => (
  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const GOOGLE_OAUTH_INTENT_KEY = "connected_google_oauth_intent";

function Login() {
  const [formData, setFormData] = useState({ usernameOrEmail: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const oauthSessionProcessingRef = useRef(false);
  const navigate = useNavigate();

  const isMobileDevice = () => window.innerWidth < 1024;

  const getGoogleUserDisplayName = (sessionUser, email) => {
    const metadata = sessionUser?.user_metadata || {};
    return metadata.full_name || metadata.name || email.split("@")[0] || "User";
  };

  const splitFullName = (fullName, email) => {
    const parts = String(fullName || "").trim().split(" ");
    if (parts.length === 1) return { firstName: parts[0], lastName: "User" };
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  };

  const createProfileFromGoogle = async (sessionUser, email) => {
    const normalizedEmail = email.toLowerCase();
    
    // Pick up the role from localStorage (switched from sessionStorage for mobile reliability)
    const storedRole = localStorage.getItem("connected_signup_role");
    const detectedRole = storedRole || (normalizedEmail.includes("teacher") ? "teacher" : "student");
    
    // Clear the stored role after use
    localStorage.removeItem("connected_signup_role");

    const displayName = getGoogleUserDisplayName(sessionUser, normalizedEmail);
    const { firstName, lastName } = splitFullName(displayName, normalizedEmail);

    const payload = {
      id: sessionUser.id,
      email: normalizedEmail,
      role: detectedRole,
      first_name: firstName,
      last_name: lastName,
      status: "Active",
      provider: "google",
      is_verified: true,
      created_at: new Date().toISOString()
    };

    // Use admin client to bypass RLS during profile creation
    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from("profiles")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      // If it already exists, just fetch it
      const { data: existing } = await supabase
        .from("profiles")
        .select("*")
        .ilike("email", normalizedEmail)
        .maybeSingle();
      
      if (existing) return existing;
      throw error;
    }

    return data;
  };

  useEffect(() => {
    if (!supabase) return;

    const handleOAuthSession = async (session) => {
      if (oauthSessionProcessingRef.current) return;
      oauthSessionProcessingRef.current = true;
      
      const email = session?.user?.email;
      if (!email) {
        setGoogleError("Google login failed: No email returned.");
        setGoogleLoading(false);
        oauthSessionProcessingRef.current = false;
        return;
      }

      setGoogleLoading(true);

      try {
        let profile;
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("*")
          .ilike("email", email)
          .maybeSingle();

        if (existingProfile) {
          profile = existingProfile;
        } else {
          // If no profile exists, check device restrictions BEFORE creating one
          const isMobile = window.innerWidth <= 1280;
          const normalizedEmail = email.toLowerCase();
          const storedRole = localStorage.getItem("connected_signup_role");
          const detectedRole = storedRole || (normalizedEmail.includes("teacher") ? "teacher" : "student");

          if (detectedRole === "student" && !isMobile) {
            throw new Error("Student accounts cannot be created on Desktop. Please use a Mobile device.");
          }
          if (detectedRole === "teacher" && isMobile && window.innerWidth < 768) {
            throw new Error("Teacher accounts should be created on Desktop for the best experience.");
          }

          profile = await createProfileFromGoogle(session.user, email);
        }

        const role = String(profile.role || "student").toLowerCase();
        const isMobile = window.innerWidth < 1024; // Use standard 1024 for dashboard redirect logic

        // Check device restrictions
        if (role === "teacher" && isMobile) {
          throw new Error("The Teacher Portal is only accessible via Desktop/Laptop.");
        }
        if (role === "student" && !isMobile) {
          throw new Error("The Student Portal is only accessible via Mobile devices.");
        }

        const currentUser = {
          id: profile.id,
          name: profile.first_name + " " + (profile.last_name || ""),
          email: profile.email,
          role: role
        };

        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        
        if (role === "admin") navigate("/admin/dashboard");
        else if (role === "teacher") navigate("/teacher/dashboard");
        else navigate("/dashboard");

      } catch (err) {
        console.error("OAuth Error:", err);
        setGoogleError(err.message || "Unable to complete Google login.");
        await supabase.auth.signOut();
      } finally {
        setGoogleLoading(false);
        oauthSessionProcessingRef.current = false;
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        await handleOAuthSession(session);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleGoogleSignIn = async () => {
    if (!supabase) {
      setGoogleError("Connection error: Supabase not configured.");
      return;
    }
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/login",
        queryParams: { prompt: "select_account" }
      }
    });
    if (error) {
      setGoogleError(error.message);
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.usernameOrEmail || !formData.password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    const normalizedEmail = formData.usernameOrEmail.trim().toLowerCase();

    // Static Admin Check
    if (normalizedEmail === STATIC_ADMIN_EMAIL) {
      const adminValidation = await validateStaticAdminCredentials(normalizedEmail, formData.password);
      if (adminValidation.ok) {
        localStorage.setItem("currentUser", JSON.stringify(getStaticAdminSessionUser()));
        navigate("/admin/dashboard");
        return;
      }
      setError(adminValidation.message);
      setLoading(false);
      return;
    }

    try {
      // Check manual credentials for Students
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (profileError || !profile) {
        setError("Account not found. Please sign up first.");
        setLoading(false);
        return;
      }

      // Check for manual password if it exists (for manual student accounts)
      if (profile.password && profile.password !== formData.password) {
        setError("Invalid password.");
        setLoading(false);
        return;
      }

      if (profile.status === "Pending") {
        setError("Your account is still pending admin approval.");
        setLoading(false);
        return;
      }

      const role = String(profile.role || "student").toLowerCase();
      const isMobile = window.innerWidth <= 1280;

      if (role === "teacher" && isMobile && window.innerWidth < 768) {
        setError("Teachers can only sign in on Desktop.");
        setLoading(false);
        return;
      }
      if (role === "student" && !isMobile) {
        setError("Students can only sign in on Mobile.");
        setLoading(false);
        return;
      }

      localStorage.setItem("currentUser", JSON.stringify({
        id: profile.id,
        name: profile.first_name + " " + (profile.last_name || ""),
        email: profile.email,
        role: role
      }));

      if (role === "admin") navigate("/admin/dashboard");
      else if (role === "teacher") navigate("/teacher/dashboard");
      else navigate("/dashboard");

    } catch (err) {
      setError("Login failed. Please check your credentials.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Connect<span className="text-emerald-600">Ed</span></h1>
          <p className="text-gray-500 text-sm">Sign in to your educational portal</p>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>}
        {googleError && <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs">{googleError}</div>}

        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-bold px-4 py-3.5 rounded-2xl border-2 border-emerald-500 transition-all shadow-sm mb-6 disabled:opacity-50"
        >
          <GoogleLogo />
          {googleLoading ? "Connecting..." : "Continue with Google"}
        </button>

        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
          <span className="relative px-4 bg-white text-[10px] font-bold text-gray-400 uppercase tracking-widest">or use credentials</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email or Username</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                name="usernameOrEmail"
                value={formData.usernameOrEmail}
                onChange={handleInputChange}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                placeholder="Enter email"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-200 transition-all disabled:opacity-50 mt-2"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">Don't have an account? <Link to="/signup" className="text-emerald-600 font-bold hover:underline">Create one</Link></p>
        </div>
      </div>
    </div>
  );
}

export { Login };
