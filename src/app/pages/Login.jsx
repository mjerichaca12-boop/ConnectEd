import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RoleSelector } from "@/app/components/RoleSelector";
import { ArrowLeft } from "lucide-react";
function Login() {
  const [formData, setFormData] = useState({
    usernameOrEmail: "",
    password: "",
    role: "student"
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError("");
  };
  const handleRoleChange = (role) => {
    setFormData({
      ...formData,
      role
    });
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.usernameOrEmail || !formData.password) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setError("");
    setTimeout(() => {
      const userData = {
        name: formData.role === "student" ? "Juan Dela Cruz" : formData.role === "teacher" ? "Sarah Rodriguez" : "System Administrator",
        email: formData.usernameOrEmail,
        role: formData.role
      };
      localStorage.setItem("currentUser", JSON.stringify(userData));
      setLoading(false);
      if (formData.role === "student") {
        navigate("/dashboard");
      } else if (formData.role === "teacher") {
        navigate("/teacher/dashboard");
      } else if (formData.role === "admin") {
        navigate("/admin/dashboard");
      }
    }, 1500);
  };
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  return <div className="min-h-screen bg-gray-50">
      {
    /* Main Content */
  }
      <div className="w-full py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {
    /* LEFT COLUMN */
  }
            <div className="w-full flex flex-col justify-center">
              <button
    type="button"
    onClick={() => navigate("/")}
    className="mb-6 inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
  >
                <ArrowLeft className="w-4 h-4" />
                Back to Landing Page
              </button>

              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Welcome back to ConnectEd
              </h1>
              
              <p className="text-lg text-gray-600 leading-relaxed">
                Log in to continue accessing your grades, assignments, communications, and all the tools 
                you need for academic success. Your school community is just a click away.
              </p>

              {
    /* Abstract Shape */
  }
              <div className="mt-10 relative h-64 hidden md:block">
                <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-100 rounded-full opacity-60" />
                <div className="absolute top-12 left-24 w-40 h-40 bg-emerald-200 rounded-full opacity-40" />
                <div className="absolute bottom-0 left-12 w-24 h-24 bg-emerald-300 rounded-full opacity-50" />
              </div>
            </div>

            {
    /* RIGHT COLUMN - Login Card */
  }
            <div className="w-full flex justify-center">
              <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md border border-gray-200">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">
                  Login
                </h2>

                {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {
    /* Role Selector */
  }
                  <RoleSelector
    value={formData.role}
    onChange={handleRoleChange}
    label="Select role"
    accentColor="emerald"
    allowedRoles={["student", "teacher", "admin"]}
  />

                  {
    /* Username or Email */
  }
                  <div>
                    <label htmlFor="usernameOrEmail" className="block text-sm font-medium text-gray-700 mb-2">
                      Username / Email
                    </label>
                    <input
    type="text"
    id="usernameOrEmail"
    name="usernameOrEmail"
    value={formData.usernameOrEmail}
    onChange={handleInputChange}
    placeholder="Enter your username or email"
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
  />
                  </div>

                  {
    /* Password */
  }
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <input
    type="password"
    id="password"
    name="password"
    value={formData.password}
    onChange={handleInputChange}
    placeholder="Enter your password"
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
  />
                  </div>

                  {
    /* Sign In Button */
  }
                  <button
    type="submit"
    disabled={loading}
    className="w-full bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:bg-emerald-400 disabled:cursor-not-allowed"
  >
                    {loading ? "Logging In..." : "Log In"}
                  </button>

                  {
    /* Links */
  }
                  <div className="space-y-3 text-center">
                    <Link to="/forgot-password" className="block text-emerald-600 hover:text-emerald-700 text-sm">
                      Forgot password?
                    </Link>
                    <p className="text-gray-600 text-sm">
                      Don't have an account?{" "}
                      <Link to="/signup" className="text-emerald-600 hover:text-emerald-700 font-medium">
                        Sign up
                      </Link>
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>;
}
export {
  Login
};
