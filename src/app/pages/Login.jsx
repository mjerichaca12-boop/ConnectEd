import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Lock, User } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
  STATIC_ADMIN_EMAIL,
  getStaticAdminSessionUser,
  normalizeEmail,
  validateStaticAdminCredentials
} from "../lib/staticAdminAuth";

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
  const [googleError, setGoogleError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();

  const resolveTeacherRecordByEmail = async (email) => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) return null;

    const profileLookup = await supabase
      .from("profiles")
      .select("*")
      .ilike("email", normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (!profileLookup.error && profileLookup.data) {
      const profileRole = String(profileLookup.data.role || "").trim().toLowerCase();
      if (profileRole === "teacher") {
        return profileLookup.data;
      }
    }

    const teacherLookup = await supabase
      .from("teachers")
      .select("*")
      .ilike("email", normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (!teacherLookup.error && teacherLookup.data) {
      const teacherRole = String(teacherLookup.data.role || "").trim().toLowerCase();
      if (!teacherRole || teacherRole === "teacher") {
        return teacherLookup.data;
      }
    }

    return null;
  };

  const findProfileByEmail = async (email) => {
    if (!supabase) return null;

    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .ilike("email", normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (error) {
      return null;
    }

    return data || null;
  };

  const getGoogleUserDisplayName = (sessionUser, email) => {
    const metadata = sessionUser?.user_metadata || {};
    const fullName = String(metadata.full_name || metadata.name || "").trim();
    if (fullName) return fullName;

    const givenName = String(metadata.given_name || "").trim();
    const familyName = String(metadata.family_name || "").trim();
    const combinedName = [givenName, familyName].filter(Boolean).join(" ").trim();
    if (combinedName) return combinedName;

    return String(email || "").split("@")[0] || "Teacher";
  };

  const splitFullName = (fullName, email) => {
    const normalized = String(fullName || "").trim().replace(/\s+/g, " ");
    const parts = normalized ? normalized.split(" ") : [];

    if (parts.length === 0) {
      return {
        firstName: String(email || "").split("@")[0] || "Teacher",
        middleName: null,
        lastName: null
      };
    }

    if (parts.length === 1) {
      return {
        firstName: parts[0],
        middleName: null,
        lastName: null
      };
    }

    if (parts.length === 2) {
      return {
        firstName: parts[0],
        middleName: null,
        lastName: parts[1]
      };
    }

    const firstName = parts[0];
    const remaining = parts.slice(1);
    const lastNameParticles = new Set(["de", "del", "dela", "la", "van", "von", "da", "dos", "di", "san", "st"]);
    const secondToLast = remaining[remaining.length - 2]?.toLowerCase();
    const useCompoundLastName = remaining.length >= 2 && lastNameParticles.has(secondToLast);
    const lastNameParts = useCompoundLastName ? remaining.slice(-2) : remaining.slice(-1);
    const middleNameParts = remaining.slice(0, remaining.length - lastNameParts.length);

    return {
      firstName,
      middleName: middleNameParts.length > 0 ? middleNameParts.join(" ") : null,
      lastName: lastNameParts.length > 0 ? lastNameParts.join(" ") : null
    };
  };

  const createTeacherProfileFromGoogle = async (sessionUser, email) => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const existingProfile = await findProfileByEmail(normalizedEmail);

    if (existingProfile) {
      const existingRole = String(existingProfile.role || "").trim().toLowerCase();
      if (existingRole === "teacher") {
        return existingProfile;
      }

      throw new Error("This email already exists with a non-teacher account.");
    }

    const displayName = getGoogleUserDisplayName(sessionUser, normalizedEmail);
    const { firstName, middleName, lastName } = splitFullName(displayName, normalizedEmail);

    const payload = {
      id: String(sessionUser?.id || crypto.randomUUID()),
      role: "teacher",
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      email: normalizedEmail,
      status: "Active"
    };

    const { data, error } = await supabase
      .from("profiles")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message || "Unable to create teacher profile.");
    }

    return data;
  };

  const ensureTeacherIsActive = async (teacherRecord, email) => {
    if (!supabase || !teacherRecord) {
      return teacherRecord;
    }

    const normalizedEmail = String(email || teacherRecord.email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return teacherRecord;
    }

    const currentStatus = String(teacherRecord.status || "").trim().toLowerCase();
    if (currentStatus === "active") {
      return {
        ...teacherRecord,
        status: "Active"
      };
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ status: "Active" })
      .eq("role", "teacher")
      .ilike("email", normalizedEmail)
      .select("*")
      .maybeSingle();

    if (!error && data) {
      return data;
    }

    return {
      ...teacherRecord,
      status: "Active"
    };
  };

  const resolveDisplayName = (record, fallbackEmail) => {
    const firstName = String(record?.first_name || "").trim();
    const middleName = String(record?.middle_name || "").trim();
    const lastName = String(record?.last_name || "").trim();
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();

    if (fullName) return fullName;
    if (String(record?.full_name || "").trim()) return String(record.full_name).trim();
    if (String(record?.name || "").trim()) return String(record.name).trim();
    if (String(record?.teacher_name || "").trim()) return String(record.teacher_name).trim();

    const email = String(fallbackEmail || "").trim();
    return email ? email.split("@")[0] : "Teacher";
  };

  const completeTeacherSession = (email, teacherRecord) => {
    const nextUser = {
      id: String(teacherRecord?.id || ""),
      name: resolveDisplayName(teacherRecord, email),
      email: String(email || "").trim().toLowerCase(),
      role: "teacher"
    };

    localStorage.setItem("currentUser", JSON.stringify(nextUser));
    navigate("/teacher/dashboard", { replace: true });
  };

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    let isMounted = true;

    const handleOAuthSession = async (session) => {
      const sessionEmail = String(session?.user?.email || "").trim().toLowerCase();
      if (!sessionEmail) {
        await supabase.auth.signOut();
        if (isMounted) {
          setGoogleError("Google login failed because no email was returned.");
          setGoogleLoading(false);
        }
        return;
      }

      if (isMounted) {
        setGoogleLoading(true);
        setGoogleError("");
      }

      try {
        let teacherRecord = await resolveTeacherRecordByEmail(sessionEmail);

        if (!teacherRecord) {
          teacherRecord = await createTeacherProfileFromGoogle(session?.user, sessionEmail);
        }

        teacherRecord = await ensureTeacherIsActive(teacherRecord, sessionEmail);

        if (isMounted) {
          completeTeacherSession(sessionEmail, teacherRecord);
        }
      } catch (authError) {
        await supabase.auth.signOut();
        localStorage.removeItem("currentUser");
        if (isMounted) {
          setGoogleError(authError instanceof Error ? authError.message : "Unable to complete Google login.");
          setGoogleLoading(false);
        }
      }
    };

    const initializeSession = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        if (isMounted) {
          setGoogleError(sessionError.message);
        }
        return;
      }

      if (data?.session?.user) {
        await handleOAuthSession(data.session);
      }
    };

    initializeSession();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await handleOAuthSession(session);
      }
    });

    return () => {
      isMounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, [navigate]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.usernameOrEmail || !formData.password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError("");

    const normalizedEmail = normalizeEmail(formData.usernameOrEmail);

    if (normalizedEmail === STATIC_ADMIN_EMAIL) {
      const adminValidation = await validateStaticAdminCredentials(formData.usernameOrEmail, formData.password);
      if (!adminValidation.ok) {
        setError(adminValidation.message);
        setLoading(false);
        return;
      }

      localStorage.setItem("currentUser", JSON.stringify(getStaticAdminSessionUser()));
      setLoading(false);
      navigate("/admin/dashboard", { replace: true });
      return;
    }

    setTimeout(() => {
      localStorage.setItem("currentUser", JSON.stringify({
        name: formData.usernameOrEmail.split("@")[0] || "Teacher",
        email: formData.usernameOrEmail,
        role: "teacher",
      }));
      setLoading(false);
      navigate("/teacher/dashboard", { replace: true });
    }, 900);
  };

  const handleGoogleSignIn = async () => {
    if (!supabase) {
      setGoogleError("Supabase client is not configured.");
      return;
    }

    setGoogleError("");
    setGoogleLoading(true);

    // Clear any stale auth session so Google always shows account selection.
    await supabase.auth.signOut();

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
      setGoogleError(oauthError.message || "Unable to start Google login.");
      setGoogleLoading(false);
    }
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
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-medium px-4 py-3 rounded-xl border border-gray-200 transition-all shadow-sm mb-5 text-sm"
          >
            <GoogleLogo />
            {googleLoading ? "Connecting to Google..." : "Continue with Google"}
          </button>
          {googleError && <p className="text-red-400 text-xs mb-4">{googleError}</p>}

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
    </div>
  );
}

export { Login };
