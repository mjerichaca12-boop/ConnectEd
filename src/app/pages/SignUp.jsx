import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Copy, Check } from "lucide-react";
import { supabase, supabaseAdmin } from "../lib/supabaseClient";

const generateTempPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

function SignUp() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1280);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [teacherForm, setTeacherForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    tempPassword: generateTempPassword()
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

  // Student signup (mobile)
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
      const admin = supabaseAdmin;
      const db = supabaseAdmin || supabase;
      if (!admin || !db) throw new Error("Database connection not configured.");

      const normalizedEmail = formData.email.trim().toLowerCase();

      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (existing) {
        setError("This email is already registered.");
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password: formData.password,
        email_confirm: true
      });
      if (authError) throw authError;

      const { error: insertError } = await db.from("profiles").insert({
        id: authData.user.id,
        email: normalizedEmail,
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: "student",
        status: "Pending",
        created_at: new Date().toISOString(),
        subjects: []
      });

      if (insertError) {
        await admin.auth.admin.deleteUser(authData.user.id).catch(() => {});
        throw insertError;
      }

      setSuccess("Registration request sent! Please wait for admin approval.");
      setFormData({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "" });
    } catch (err) {
      console.error("Sign-up Error:", err);
      setError(err.message || "Failed to submit registration. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Teacher signup (desktop)
  const handleTeacherSignUp = async (e) => {
    e.preventDefault();
    if (!teacherForm.firstName || !teacherForm.lastName || !teacherForm.email) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const admin = supabaseAdmin;
      const db = supabaseAdmin || supabase;
      if (!admin || !db) throw new Error("Admin client not configured.");

      const normalizedEmail = teacherForm.email.trim().toLowerCase();

      // Check existing profile
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (existing) {
        setError("This email is already registered.");
        setLoading(false);
        return;
      }

      // Prevent duplicate pending access requests — try canonical plural table first
      const requestTables = ["teacher_access_requests", "teacher_access_request", "teacher_request_access"];

      try {
        let existingRequest = null;
        let requestLookupTable = null;

        for (const requestTable of requestTables) {
          const { data, error } = await db
            .from(requestTable)
            .select("id, status")
            .ilike("email", normalizedEmail)
            .maybeSingle();

          if (!error || !String(error.message || "").toLowerCase().includes("relation")) {
            existingRequest = data;
            requestLookupTable = requestTable;
            break;
          }
        }

        if (existingRequest && String(existingRequest.status || "").toLowerCase() === "pending") {
          setError("An access request for this email is already pending review.");
          setLoading(false);
          return;
        }

        console.log("SignUp: existing request lookup", {
          email: normalizedEmail,
          found: !!existingRequest,
          table: requestLookupTable
        });
      } catch (reqCheckErr) {
        console.warn("SignUp: failed to check existing teacher request", reqCheckErr);
      }

      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password: teacherForm.tempPassword,
        email_confirm: true
      });
      if (authError) throw authError;

      const { error: insertError } = await db.from("profiles").insert({
        id: authData.user.id,
        email: normalizedEmail,
        first_name: teacherForm.firstName.trim(),
        last_name: teacherForm.lastName.trim(),
        role: "teacher",
        status: "Pending",
        created_at: new Date().toISOString()
      });

      console.log("SignUp: profiles insert result", {
        email: normalizedEmail,
        success: !insertError,
        error: insertError?.message
      });

      if (insertError) {
        await admin.auth.admin.deleteUser(authData.user.id).catch(() => {});
        throw insertError;
      }

      // Insert corresponding teacher access request so admin panel can review
      try {
        const fullName = `${teacherForm.firstName.trim()} ${teacherForm.lastName.trim()}`;
        const requestInsertPayload = {
          email: normalizedEmail,
          name: fullName,
          school_name: null,
          position: null,
          subject_area: null,
          phone_number: null,
          additional_info: null,
          status: "pending",
          requested_at: new Date().toISOString(),
          profile_id: authData.user.id
        };

        let reqData = null;
        let reqError = null;
        let requestInsertTable = null;

        for (const requestTable of requestTables) {
          console.log("SignUp: inserting teacher request row", { requestTable, email: normalizedEmail, payload: requestInsertPayload });
          const result = await db
            .from(requestTable)
            .insert([requestInsertPayload])
            .select("id")
            .maybeSingle();

          reqData = result.data;
          reqError = result.error;
          requestInsertTable = requestTable;

          // If table doesn't exist, try next. If success or other error, stop.
          if (!reqError || !String(reqError.message || "").toLowerCase().includes("relation")) {
            break;
          }
        }

        if (reqError) {
          console.error("SignUp: failed to insert teacher request row", {
            table: requestInsertTable,
            error: reqError
          });
        } else {
          console.log("SignUp: created teacher request row", {
            table: requestInsertTable,
            id: reqData?.id,
            email: normalizedEmail
          });

          try {
            localStorage.setItem("connected_access_requests_refresh", String(Date.now()));
            window.dispatchEvent(new Event("connected:access-requests-updated"));
          } catch (refreshError) {
            console.warn("SignUp: failed to broadcast access-request refresh", refreshError);
          }
        }
      } catch (e) {
        console.error("SignUp: unexpected error inserting teacher request row", e);
      }

      setSuccess(teacherForm.tempPassword);
      setTeacherForm({ firstName: "", lastName: "", email: "", tempPassword: generateTempPassword() });
    } catch (err) {
      setError(err.message || "Failed to submit registration. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(success).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
            </div>

            {/* Right Card */}
            <div className="w-full flex justify-center">
              <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-md border border-gray-100">
                <div className="mb-10 text-center">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h2>
                  <p className="text-gray-500 text-sm">
                    {isMobile ? "Sign up as a Student" : "Sign up as a Teacher"}
                  </p>
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
                    /* ── Student form ── */
                    <form onSubmit={handleManualSignUp} className="space-y-4">
                      {success && (
                        <div className="mb-2 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
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
                  ) : success ? (
                    /* ── Teacher success screen ── */
                    <div className="space-y-4">
                      <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                        <p className="text-emerald-700 font-semibold mb-1">Registration request sent!</p>
                        <p className="text-emerald-600 text-sm mb-4">Wait for admin approval. Save your temporary password below.</p>
                        <div className="flex items-center justify-between gap-2 bg-white border border-emerald-300 rounded-xl px-4 py-3">
                          <span className="font-mono text-lg font-bold text-gray-800 tracking-widest">{success}</span>
                          <button
                            type="button"
                            onClick={handleCopyPassword}
                            className="text-emerald-600 hover:text-emerald-800 transition-colors"
                            title="Copy password"
                          >
                            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">You will use this password to log in once approved.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate("/login")}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl transition-all text-sm"
                      >
                        Go to Login
                      </button>
                    </div>
                  ) : (
                    /* ── Teacher form ── */
                    <form onSubmit={handleTeacherSignUp} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">First Name</label>
                          <input
                            type="text"
                            value={teacherForm.firstName}
                            onChange={(e) => { setTeacherForm({ ...teacherForm, firstName: e.target.value }); setError(""); }}
                            placeholder="Juan"
                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Last Name</label>
                          <input
                            type="text"
                            value={teacherForm.lastName}
                            onChange={(e) => { setTeacherForm({ ...teacherForm, lastName: e.target.value }); setError(""); }}
                            placeholder="Dela Cruz"
                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
                        <input
                          type="email"
                          value={teacherForm.email}
                          onChange={(e) => { setTeacherForm({ ...teacherForm, email: e.target.value }); setError(""); }}
                          placeholder="teacher@example.com"
                          className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Temporary Password</label>
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5">
                          <span className="flex-1 font-mono text-sm font-semibold text-gray-700 tracking-widest">{teacherForm.tempPassword}</span>
                          <button
                            type="button"
                            onClick={() => setTeacherForm({ ...teacherForm, tempPassword: generateTempPassword() })}
                            className="text-gray-400 hover:text-emerald-600 transition-colors"
                            title="Regenerate password"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 ml-1">Auto-generated. Save this — you'll use it to log in.</p>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 transition-all active:scale-[0.98] disabled:opacity-70 text-lg"
                      >
                        {loading ? "Submitting..." : "Send Request"}
                      </button>
                    </form>
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
