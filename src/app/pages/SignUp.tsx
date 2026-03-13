import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RoleSelector } from '@/app/components/RoleSelector';
import { Info, MapPin, ArrowLeft } from 'lucide-react';

type PasswordStrength = 'weak' | 'medium' | 'strong' | '';

interface School {
  id: string;
  name: string;
  location: string;
}

export function SignUp() {
  const [formData, setFormData] = useState({
    role: 'student',
    fullName: '',
    emailOrId: '',
    contactNumber: '',
    password: '',
    confirmPassword: '',
    agreedToTerms: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get selected school from localStorage
    const schoolData = localStorage.getItem('selectedSchool');
    if (schoolData) {
      setSelectedSchool(JSON.parse(schoolData));
    } else {
      // If no school selected, redirect to school selection
      navigate('/school-selection');
    }
  }, [navigate]);

  const calculatePasswordStrength = (password: string): PasswordStrength => {
    if (!password) return '';
    if (password.length < 6) return 'weak';
    if (password.length < 10) return 'medium';
    if (password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      return 'strong';
    }
    return 'medium';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });

    // Calculate password strength
    if (name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value));
    }

    // Clear error for this field
    setErrors({ ...errors, [name]: '' });
  };

  const handleRoleChange = (role: string) => {
    setFormData({
      ...formData,
      role
    });
  };

  const handleChangeSchool = () => {
    navigate('/school-selection');
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!formData.emailOrId.trim()) newErrors.emailOrId = 'Email or School ID is required';
    if (!formData.contactNumber.trim()) newErrors.contactNumber = 'Contact number is required';
    if (!formData.password) newErrors.password = 'Password is required';
    if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!formData.agreedToTerms) {
      newErrors.agreedToTerms = 'You must agree to the terms and privacy policy';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setSuccessMessage('');

    // Simulate account creation
    setTimeout(() => {
      // Save user data to localStorage
      const userData = {
        name: formData.fullName,
        email: formData.emailOrId,
        role: formData.role
      };
      localStorage.setItem('currentUser', JSON.stringify(userData));
      
      setSuccessMessage(`Account created successfully for ${formData.fullName}!`);
      setLoading(false);
      
      // Redirect to dashboard after short delay based on role
      setTimeout(() => {
        if (formData.role === 'student') {
          navigate('/dashboard');
        } else if (formData.role === 'teacher') {
          navigate('/teacher/dashboard');
        }
      }, 1500);
    }, 1500);
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case 'weak': return 'bg-red-500';
      case 'medium': return 'bg-blue-500';
      case 'strong': return 'bg-emerald-500';
      default: return 'bg-gray-300';
    }
  };

  const getPasswordStrengthWidth = () => {
    switch (passwordStrength) {
      case 'weak': return 'w-1/3';
      case 'medium': return 'w-2/3';
      case 'strong': return 'w-full';
      default: return 'w-0';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* School Header Badge */}
      {selectedSchool && (
        <div className="w-full bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{selectedSchool.name}</div>
                  <div className="text-sm text-gray-500">{selectedSchool.location}</div>
                </div>
              </div>
              <button 
                onClick={handleChangeSchool}
                className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 transition-colors font-medium text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Change School
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="w-full py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* LEFT COLUMN */}
            <div className="w-full flex flex-col justify-start">
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Create your ConnectEd account
              </h1>
              
              <p className="text-lg text-gray-600 leading-relaxed mb-8">
                Join thousands of students and teachers using ConnectEd. 
                Get instant access to academic records, communication tools, and school updates—all in one unified platform designed for your educational journey.
              </p>

              {/* Academic-themed Abstract Shapes */}
              <div className="relative h-64 hidden md:block">
                <div className="absolute top-4 left-8 w-28 h-28 bg-emerald-100 rounded-2xl rotate-12 opacity-70"></div>
                <div className="absolute top-20 left-32 w-36 h-36 bg-emerald-200 rounded-2xl -rotate-6 opacity-50"></div>
                <div className="absolute bottom-8 left-16 w-24 h-24 bg-emerald-300 rounded-2xl rotate-45 opacity-60"></div>
                <div className="absolute top-32 right-12 w-16 h-16 bg-teal-200 rounded-full opacity-40"></div>
              </div>
            </div>

            {/* RIGHT COLUMN - Sign Up Card */}
            <div className="w-full flex justify-center">
              <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-gray-100">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">
                  Create Account
                </h2>

                {successMessage && (
                  <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-emerald-600 text-sm">{successMessage}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Role Selector - Only Students and Teachers */}
                  <RoleSelector
                    value={formData.role}
                    onChange={handleRoleChange}
                    label="Select Role"
                    required
                    allowedRoles={['student', 'teacher']}
                    accentColor="emerald"
                  />

                  {/* Administrator Notice */}
                  <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <Info className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-emerald-700">
                      Administrator accounts are created by the school system.
                    </p>
                  </div>

                  {/* Full Name */}
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      placeholder="Enter your full name"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${
                        errors.fullName ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.fullName && <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>}
                  </div>

                  {/* Email or School ID */}
                  <div>
                    <label htmlFor="emailOrId" className="block text-sm font-medium text-gray-700 mb-2">
                      Email or School ID *
                    </label>
                    <input
                      type="text"
                      id="emailOrId"
                      name="emailOrId"
                      value={formData.emailOrId}
                      onChange={handleInputChange}
                      placeholder="Enter your email or school ID"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${
                        errors.emailOrId ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.emailOrId && <p className="text-red-500 text-sm mt-1">{errors.emailOrId}</p>}
                  </div>

                  {/* Contact Number */}
                  <div>
                    <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Number *
                    </label>
                    <input
                      type="tel"
                      id="contactNumber"
                      name="contactNumber"
                      value={formData.contactNumber}
                      onChange={handleInputChange}
                      placeholder="Enter your contact number"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${
                        errors.contactNumber ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.contactNumber && <p className="text-red-500 text-sm mt-1">{errors.contactNumber}</p>}
                  </div>

                  {/* Password */}
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
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${
                        errors.password ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
                    
                    {/* Password Strength Indicator */}
                    {formData.password && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-300 ${getPasswordStrengthColor()} ${getPasswordStrengthWidth()}`}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-600 capitalize">{passwordStrength}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
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
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${
                        errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
                  </div>

                  {/* Terms Checkbox */}
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
                        I agree to the{' '}
                        <Link to="/terms-and-privacy" className="text-emerald-600 hover:text-emerald-700 font-medium hover:underline">
                          Terms and Privacy Policy
                        </Link>
                      </span>
                    </label>
                    {errors.agreedToTerms && <p className="text-red-500 text-sm mt-1">{errors.agreedToTerms}</p>}
                  </div>

                  {/* Create Account Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-all disabled:bg-emerald-400 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30"
                  >
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </button>

                  {/* Login Link */}
                  <div className="text-center pt-2">
                    <p className="text-gray-600 text-sm">
                      Already have an account?{' '}
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
    </div>
  );
}