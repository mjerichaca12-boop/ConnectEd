import { useNavigate } from 'react-router-dom';

export function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="w-full max-w-full bg-gray-900 py-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-2xl font-bold text-white mb-2">ConnectEd</h3>
            <p className="text-gray-400">Connecting Education, One Portal at a Time</p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Contact Us</a>
            <a href="#" className="hover:text-white transition-colors">Support</a>
            {/* Secret Admin Link */}
            <button 
              onClick={() => navigate('/admin')}
              className="hover:text-white transition-colors opacity-50 hover:opacity-100"
              title="System"
            >
              System
            </button>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
          © {new Date().getFullYear()} ConnectEd. All rights reserved.
        </div>
      </div>
    </footer>
  );
}