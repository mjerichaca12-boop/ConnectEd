import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Building2, User, Send, CheckCircle } from "lucide-react";
function SchoolRequest() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    schoolName: "",
    schoolAddress: "",
    city: "",
    province: "",
    contactPerson: "",
    contactEmail: "",
    contactNumber: "",
    additionalInfo: ""
  });
  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("School request submitted:", formData);
    setSubmitted(true);
    setTimeout(() => {
      navigate("/school-selection");
    }, 3e3);
  };
  if (submitted) {
    return <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Request Submitted!</h2>
            <p className="text-gray-600 mb-6">
              Thank you for your request. Our team will review your school information and add it to our system soon.
            </p>
            <p className="text-sm text-gray-500">
              Redirecting you back to school selection...
            </p>
          </div>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        {
    /* Header */
  }
        <div className="mb-8">
          <Link
    to="/school-selection"
    className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium mb-6 transition-colors"
  >
            <ArrowLeft className="w-5 h-5" />
            Back to School Selection
          </Link>
          
          <div className="text-center">
            <h1 className="text-4xl font-bold text-emerald-600 mb-2">
              ConnectEd
            </h1>
            <div className="w-16 h-1 bg-emerald-600 mx-auto rounded-full mb-8" />
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              Request Your School
            </h2>
            <p className="text-gray-600">
              Can't find your school? Fill out this form and we'll add it to our system.
            </p>
          </div>
        </div>

        {
    /* Form Card */
  }
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {
    /* School Information */
  }
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                School Information
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    School Name *
                  </label>
                  <input
    type="text"
    required
    value={formData.schoolName}
    onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
    placeholder="Enter full school name"
  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    School Address *
                  </label>
                  <input
    type="text"
    required
    value={formData.schoolAddress}
    onChange={(e) => setFormData({ ...formData, schoolAddress: e.target.value })}
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
    placeholder="Street address"
  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City/Municipality *
                    </label>
                    <input
    type="text"
    required
    value={formData.city}
    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
    placeholder="e.g., Dasmariñas"
  />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Province *
                    </label>
                    <input
    type="text"
    required
    value={formData.province}
    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
    placeholder="e.g., Cavite"
  />
                  </div>
                </div>
              </div>
            </div>

            {
    /* Contact Information */
  }
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" />
                Contact Person
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Name *
                  </label>
                  <input
    type="text"
    required
    value={formData.contactPerson}
    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
    placeholder="Your full name"
  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
    type="email"
    required
    value={formData.contactEmail}
    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
    placeholder="your.email@example.com"
  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Number *
                  </label>
                  <input
    type="tel"
    required
    value={formData.contactNumber}
    onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
    placeholder="09XX XXX XXXX"
  />
                </div>
              </div>
            </div>

            {
    /* Additional Information */
  }
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Information (Optional)
              </label>
              <textarea
    value={formData.additionalInfo}
    onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
    rows={4}
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
    placeholder="Any additional details about your school or request..."
  />
            </div>

            {
    /* Submit Button */
  }
            <button
    type="submit"
    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-4 rounded-lg font-medium hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 flex items-center justify-center gap-2"
  >
              <Send className="w-5 h-5" />
              Submit Request
            </button>
          </form>
        </div>

        {
    /* Footer Note */
  }
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            We typically review and add schools within 1-2 business days.
          </p>
        </div>
      </div>
    </div>;
}
export {
  SchoolRequest
};
