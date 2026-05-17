import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

function SignUp() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Automatic role detection based on screen size
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const signupRole = isMobile ? "student" : "teacher";

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    gradeLevel: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: ""
  });

  const validatePassword = (pass) => {
    if (pass.length < 12) return "Password must be at least 12 characters long.";
    if (!/[0-9]/.test(pass)) return "Password must contain at least one number.";
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pass)) return "Password must contain at least one special character.";
    return null;
  };

  const GRADE_LEVELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    const { firstName, middleName, lastName, gradeLevel, email, phone, password, confirmPassword } = formData;
    
    if (!firstName || !lastName || !email || !password || !gradeLevel) {
      setError("Please fill in all required fields.");
      return;
    }
    
    if (!email.toLowerCase().endsWith("@gmail.com")) {
      setError("Please use a valid Gmail account for registration.");
      return;
    }

    const passError = validatePassword(password);
    if (passError) {
      setError(passError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // Check if profile exists locally
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

      const envBackendUrl = import.meta.env.VITE_BACKEND_URL;
      const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(window.location.hostname);
      const isLocal = window.location.hostname === "localhost" || 
                      window.location.hostname === "127.0.0.1" || 
                      isIP;
      
      const primaryBackendUrl = envBackendUrl || (isLocal 
        ? `http://${window.location.hostname}:3001` 
        : "https://9351b61a3073cb.lhr.life");
        
      const registrationUrl = `${primaryBackendUrl}/auth/register`;
      
      const response = await fetch(registrationUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password: password,
          role: signupRole,
          firstName: firstName,
          middleName: middleName,
          lastName: lastName,
          year: gradeLevel,
          phone: phone,
          status: signupRole === "teacher" ? "Pending" : "Active"
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to register.");
      }

      if (signupRole === "teacher") {
        setSuccess("Registration request sent! Your teacher account is now pending admin approval. You can log in once an administrator approves your access.");
      } else {
        setSuccess("Account created successfully! You can now log in to your portal.");
      }
      
      setFormData({ firstName: "", middleName: "", lastName: "", gradeLevel: "", email: "", phone: "", password: "", confirmPassword: "" });
    } catch (err) {
      console.error("Sign-up Error:", err);
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
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
            </div>

            {/* Right Card */}
            <div className="w-full flex justify-center">
              <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-md border border-gray-100">
                <div className="mb-10 text-center">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h2>
                  <p className="text-gray-500 text-sm">
                    Register as a <span className="text-emerald-600 font-bold">{isMobile ? "Student" : "Teacher"}</span>
                  </p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-red-600 text-sm font-medium">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="mb-6 p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                    <p className="text-emerald-700 font-semibold mb-4">{success}</p>
                    <button
                      type="button"
                      onClick={() => navigate("/login")}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md active:scale-95"
                    >
                      Go to Login
                    </button>
                  </div>
                )}

                {!success && (
                  <form onSubmit={handleSignUp} className="space-y-4">
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
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Middle Name</label>
                        <input
                          type="text"
                          name="middleName"
                          value={formData.middleName}
                          onChange={handleInputChange}
                          placeholder="Quincy"
                          className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Grade Level</label>
                        <select
                          name="gradeLevel"
                          value={formData.gradeLevel}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm appearance-none"
                        >
                          <option value="">Select Grade</option>
                          {GRADE_LEVELS.map(g => (
                            <option key={g} value={g}>Grade {g}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Gmail Address</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="example@gmail.com"
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Phone Number</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="09XXXXXXXXX"
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

                    <p className="text-[10px] text-gray-400 px-1 leading-relaxed">
                      Password must be at least 12 characters, include a number and a special character.
                    </p>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 transition-all active:scale-[0.98] disabled:opacity-70 text-lg"
                    >
                      {loading ? "Processing..." : signupRole === "teacher" ? "Submit Registration" : "Create Account"}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { SignUp };
