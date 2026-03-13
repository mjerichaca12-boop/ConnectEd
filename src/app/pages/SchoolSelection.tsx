import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SchoolSelector, School } from '@/app/components/SchoolSelector';
import { HelpCircle } from 'lucide-react';

// Mock school data - in a real app, this would come from an API
const SCHOOLS: School[] = [
  { id: '1', name: 'Paliparan II Integrated High School', location: 'Dasmariñas, Cavite' },
  { id: '2', name: 'Emmanuel Ressurection Congressional Integrated High School', location: 'Dasmariñas, Cavite' },
  { id: '3', name: 'Francisco E. Barzaga Integrated High School', location: 'Dasmariñas, Cavite' },
  { id: '4', name: 'Congressional Integrated High School', location: 'Dasmariñas, Cavite' },
  { id: '5', name: 'Paliparan National High School', location: 'Dasmariñas, Cavite' },
];

export function SchoolSelection() {
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const navigate = useNavigate();

  const handleContinue = () => {
    if (selectedSchool) {
      // Save selected school to localStorage
      localStorage.setItem('selectedSchool', JSON.stringify(selectedSchool));
      // Navigate to login page
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-emerald-600 mb-2">
            ConnectEd
          </h1>
          <div className="w-16 h-1 bg-emerald-600 mx-auto rounded-full"></div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              Select Your School
            </h2>
            <p className="text-gray-600">
              Choose your school to continue to login or create an account.
            </p>
          </div>

          {/* School Selector */}
          <div className="mb-6">
            <SchoolSelector
              value={selectedSchool}
              onChange={setSelectedSchool}
              schools={SCHOOLS}
              placeholder="Search for your school..."
            />
          </div>

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            disabled={!selectedSchool}
            className="w-full bg-emerald-600 text-white px-6 py-4 rounded-lg font-medium hover:bg-emerald-700 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 disabled:shadow-none mb-4"
          >
            Continue
          </button>

          {/* Help Link */}
          <div className="text-center">
            <Link 
              to="/school-request" 
              className="text-sm text-gray-600 hover:text-emerald-600 transition-colors inline-flex items-center gap-2"
            >
              <HelpCircle className="w-4 h-4" />
              Can't find your school?
            </Link>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Your school uses ConnectEd to manage academic records, communications, and more.
          </p>
        </div>
      </div>
    </div>
  );
}