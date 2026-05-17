import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, User, Phone, Check } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";

const ACCESS_REQUEST_REFRESH_KEY = "connected_access_requests_refresh";

function RequestAccess() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    middleName: "",
    lastName: "",
    phone: "",
    schoolName: "",
    position: "",
    subjects: "",
    additionalInfo: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const getFullName = () => {
    return [formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(" ").trim();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validation
    if (!formData.email.trim()) {
      setError("Email is required.");
      setLoading(false);
      return;
    }

    if (!validateEmail(formData.email)) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError("First and last name are required.");
      setLoading(false);
      return;
    }

    try {
      if (!supabase) {
        throw new Error("Supabase client is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      }

      // Log submitted form data for debugging
      console.log("[RequestAccess] submitting form:", formData);

      const email = formData.email.toLowerCase().trim();
      const fullName = [formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(" ").trim();

      // Candidate request tables to try (try canonical singular first)
      const REQUEST_TABLES = ["teacher_access_request", "teacher_request_access", "teacher_access_requests"];

      // Prevent duplicate pending requests by checking existing request in any candidate table
      for (const t of REQUEST_TABLES) {
        try {
          const { data: existing, error: lookupErr } = await supabase
            .from(t)
            .select("id, status, email")
            .ilike("email", email)
            .maybeSingle();

          if (lookupErr && !String(lookupErr.message || "").toLowerCase().includes("does not exist")) {
            console.warn(`[RequestAccess] lookup error on table ${t}:`, lookupErr.message);
          }

          if (existing) {
            const s = String(existing.status || "").toLowerCase();
            if (s === "pending") {
              setError("You already have a pending access request. Please wait for an administrator to review it.");
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn(`[RequestAccess] error checking duplicates on ${t}:`, e);
        }
      }

      // Build payloads for both new and legacy schemas
      const newPayload = {
        email,
        first_name: formData.firstName.trim(),
        middle_name: formData.middleName.trim() || null,
        last_name: formData.lastName.trim(),
        phone: formData.phone.trim() || null,
        school_name: formData.schoolName.trim() || null,
        position: formData.position.trim() || null,
        subjects: formData.subjects ? formData.subjects.split(",").map((s) => s.trim()).filter(Boolean) : [],
        additional_info: formData.additionalInfo.trim() || null,
        status: "pending"
      };

      const legacyPayload = {
        email,
        name: fullName || email,
        school_name: formData.schoolName.trim() || null,
        position: formData.position.trim() || null,
        subject_area: formData.subjects || null,
        phone_number: formData.phone.trim() || null,
        additional_info: formData.additionalInfo.trim() || null,
        status: "pending"
      };

      // Try inserting into candidate tables, preferring new schema insert
      let inserted = null;
      let insertError = null;
      let usedTable = null;

      for (const table of REQUEST_TABLES) {
        try {
          console.log(`[RequestAccess] attempting insert into ${table} with payload:`, newPayload);
          const { data: insertData, error: insertErr } = await supabase
            .from(table)
            .insert([newPayload])
            .select()
            .single();

          if (!insertErr) {
            inserted = insertData;
            usedTable = table;
            console.log(`[RequestAccess] inserted into ${table}:`, insertData);
            break;
          }

          // If column missing, try legacy payload
          const msg = String(insertErr.message || "").toLowerCase();
          if (msg.includes("could not find") || msg.includes("column") || msg.includes("first_name") || msg.includes("last_name")) {
            console.warn(`[RequestAccess] new-schema insert failed on ${table}, trying legacy payload:`, insertErr.message);
            console.log(`[RequestAccess] attempting legacy insert into ${table} with payload:`, legacyPayload);
            const { data: legacyData, error: legacyErr } = await supabase
              .from(table)
              .insert([legacyPayload])
              .select()
              .single();

            if (!legacyErr) {
              inserted = legacyData;
              usedTable = table;
              console.log(`[RequestAccess] legacy insert succeeded into ${table}:`, legacyData);
              break;
            }

            insertError = legacyErr;
            console.warn(`[RequestAccess] legacy insert failed on ${table}:`, legacyErr.message);
          } else {
            insertError = insertErr;
            console.warn(`[RequestAccess] insert failed on ${table}:`, insertErr.message);
          }
        } catch (e) {
          insertError = e;
          console.error(`[RequestAccess] unexpected error inserting into ${table}:`, e);
        }
      }

      if (!inserted) {
        console.error("[RequestAccess] failed to insert access request:", insertError);
        setError(insertError?.message || "Failed to submit access request. Please try again later.");
        setLoading(false);
        return;
      }

      // Broadcast refresh so admin page picks up the new request immediately
      try {
        window.localStorage.setItem(ACCESS_REQUEST_REFRESH_KEY, JSON.stringify({ at: Date.now(), email, source: "RequestAccess" }));
        window.dispatchEvent(new Event("connected:access-requests-updated"));
      } catch (refreshError) {
        console.warn("[RequestAccess] failed to broadcast refresh signal:", refreshError);
      }

      setSuccess(true);
      setLoading(false);

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while submitting your request.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg bg-white border border-gray-100 rounded-2xl p-8 shadow-xl">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Request Submitted!</h1>
            <p className="text-gray-600 mb-6">
              Thank you for submitting your access request. An administrator will review your application and send you an invitation email if approved.
            </p>
            <div className="w-full p-4 rounded-xl bg-green-50 border border-green-200 mb-6">
              <p className="text-green-700 text-sm font-medium">
                ✓ Your request has been recorded for <span className="font-semibold">{getFullName() || "pending"}</span>
              </p>
            </div>
            <p className="text-gray-600 text-sm mb-8">
              Redirecting you to login in a few seconds...
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] relative overflow-hidden p-12">
        <div className="absolute top-0 left-0 right-0 h-1 flex">
          <div className="flex-1 bg-green-500" />
          <div className="flex-1 bg-blue-600" />
          <div className="flex-1 bg-red-600" />
        </div>

        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000006_1px,transparent_1px),linear-gradient(to_bottom,#00000006_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-green-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          <button
            onClick={() => navigate("/login")}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-green-600 text-sm font-medium transition-colors mb-16"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </button>

          <div>
            <p className="text-gray-900 font-extrabold text-2xl tracking-tight leading-none">
              Connect<span className="text-green-600">Ed</span>
            </p>
            <p className="text-gray-600 text-xs font-medium mt-0.5">Teacher Portal · Web Platform</p>
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold text-gray-900 leading-tight mt-10 mb-4">
            Request Access to<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 via-blue-600 to-red-600">
              ConnectEd.
            </span>
          </h1>
          <p className="text-gray-600 text-base leading-relaxed max-w-md">
            Submit your information and an administrator will review your request. Upon approval, you'll receive an invitation email to set your password.
          </p>
        </div>

        <div className="relative border-t border-gray-200 pt-6">
          <p className="text-gray-500 text-xs">
            ConnectEd · Official School Management System · DasmariÃ±as, Cavite
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 relative">
        <div className="absolute top-0 right-0 bottom-0 w-0.5 flex flex-col lg:flex">
          <div className="flex-1 bg-green-500/40" />
          <div className="flex-1 bg-blue-600/40" />
          <div className="flex-1 bg-red-600/40" />
        </div>

        <button
          onClick={() => navigate("/login")}
          className="lg:hidden absolute top-6 left-6 inline-flex items-center gap-2 text-gray-500 hover:text-green-600 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Login
        </button>

        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-10 justify-center">
            <span className="text-gray-900 font-extrabold text-xl">
              Connect<span className="text-green-600">Ed</span>
            </span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Request Access</h2>
            <p className="text-gray-600 text-sm">Fill in your information below</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address *
                </div>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="teacher@school.edu.ph"
                className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 px-4 py-3 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all text-sm"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone
                </div>
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="09XXXXXXXXX"
                className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 px-4 py-3 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all text-sm"
              />
            </div>

            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  First Name *
                </div>
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                placeholder="Juan"
                className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 px-4 py-3 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all text-sm"
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Last Name *
                </div>
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                placeholder="Cruz"
                className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 px-4 py-3 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="md:col-span-2 w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-green-600/20 text-sm mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Access Request"
              )}
            </button>
          </form>

          <p className="text-gray-600 text-xs text-center mt-6">
            Already have an invitation? <Link to="/set-password" className="text-green-600 hover:text-green-700 font-semibold">Set your password here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export { RequestAccess };
