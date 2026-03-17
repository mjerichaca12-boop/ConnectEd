import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, User, ArrowLeft } from 'lucide-react';

export function AdminLogin() {
  const [formData, setFormData] = useState({
    adminId: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Clear any existing user data when accessing admin login
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      const user = JSON.parse(currentUser);
      // If already logged in as admin, redirect to dashboard
      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      }
    }
  }, [navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.adminId || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    // Simulate admin authentication with stricter validation
    setTimeout(() => {
      // For demo purposes - in production, this would validate against actual admin credentials
      // You could add specific admin IDs here
      if (formData.adminId && formData.password) {
        // Save admin data to localStorage
        const userData = {
          name: 'System Administrator',
          email: formData.adminId,
          role: 'admin'
        };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        setLoading(false);
        navigate('/admin/dashboard');
      } else {
        setError('Invalid admin credentials');
        setLoading(false);
      }
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-emerald-900 to-gray-900 flex items-center justify-center px-6 py-12">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-600 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Back to Landing Page */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-emerald-200 hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Landing Page
        </button>

        {/* Admin Login Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-8 text-center">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 border-2 border-white/30">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Administrator Access</h1>
            <p className="text-emerald-100 text-sm">System-level authentication required</p>
          </div>

          {/* Form */}
          <div className="p-8">
            {/* Developer Credentials Notice */}
            <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg backdrop-blur-sm">
              <p className="text-blue-200 text-sm text-center">
                <strong>Developer Access:</strong> Use <code className="bg-blue-900/30 px-2 py-1 rounded">admin</code> / <code className="bg-blue-900/30 px-2 py-1 rounded">admin123</code>
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg backdrop-blur-sm">
                <p className="text-red-200 text-sm text-center">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Admin ID */}
              <div>
                <label htmlFor="adminId" className="block text-sm font-medium text-white mb-2">
                  Administrator ID
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <User className="w-5 h-5 text-emerald-300" />
                  </div>
                  <input
                    type="text"
                    id="adminId"
                    name="adminId"
                    value={formData.adminId}
                    onChange={handleInputChange}
                    placeholder="Enter administrator ID"
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent backdrop-blur-sm"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <Lock className="w-5 h-5 text-emerald-300" />
                  </div>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter password"
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent backdrop-blur-sm"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-lg font-medium hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Authenticating...
                  </div>
                ) : (
                  'Access Admin Portal'
                )}
              </button>
            </form>

            {/* Forgot Password Link */}
            <div className="mt-4 text-center">
              <Link to="/forgot-password" className="text-emerald-200 hover:text-emerald-100 text-sm transition-colors">
                Forgot password?
              </Link>
            </div>

            {/* Security Notice */}
            <div className="mt-6 p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg backdrop-blur-sm">
              <p className="text-blue-100 text-xs text-center">
                <strong>Security Notice:</strong> This area is restricted to authorized system administrators only. 
                All access attempts are logged and monitored.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Notice */}
        <div className="text-center mt-6">
          <p className="text-emerald-200 text-sm">
            ConnectEd Academic Portal - Administrator Console
          </p>
        </div>
      </div>
    </div>
  );
}