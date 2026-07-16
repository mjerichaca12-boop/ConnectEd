import { useState } from "react";
import { Link } from "react-router-dom";
import { Navigation } from "../components/Navigation";
import { Footer } from "../components/Footer";
import { ChevronDown, ChevronUp, LifeBuoy, Wrench, MessageCircle, Clock } from "lucide-react";

function Support() {
  const [openFaq, setOpenFaq] = useState(null);

  const faqs = [
    {
      question: "How do I reset my password?",
      answer: "If you're a student or teacher, you can click on 'Forgot Password' on the login screen. You will be prompted to enter your email to receive a reset link. Alternatively, contact your school administrator to issue a temporary password."
    },
    {
      question: "I can't see my classes or grades. What should I do?",
      answer: "Classes and grades are assigned by your teachers or administrators. If your dashboard appears empty, please ensure you are enrolled in the current semester. If the issue persists, contact your teacher directly."
    },
    {
      question: "How do I update my profile information?",
      answer: "You can update your profile information, such as your profile picture and contact details, by navigating to the Profile section from the main dashboard menu."
    },
    {
      question: "Is ConnectEd accessible on mobile devices?",
      answer: "The Student Portal is fully optimized for mobile devices. However, the Teacher and Administrator portals require a desktop or tablet for full functionality and security."
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      
      {/* Header */}
      <div className="bg-green-600 text-white py-20 px-6 mt-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
            <LifeBuoy className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-4">How can we help you?</h1>
          <p className="text-green-100 text-lg max-w-2xl mx-auto">
            Browse our frequently asked questions, learn how to troubleshoot common issues, or reach out to our support team.
          </p>
        </div>
      </div>

      <div className="flex-grow max-w-6xl w-full mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* Main Content: FAQ & Troubleshooting */}
        <div className="lg:col-span-2 space-y-12">
          
          {/* FAQ Section */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <MessageCircle className="w-6 h-6 text-green-600" />
              <h2 className="text-2xl font-bold text-gray-900">Frequently Asked Questions</h2>
            </div>
            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-2xl overflow-hidden transition-all shadow-sm hover:border-green-300">
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full flex items-center justify-between p-5 text-left bg-white focus:outline-none cursor-pointer"
                  >
                    <span className="font-semibold text-gray-900 pr-4">{faq.question}</span>
                    {openFaq === idx ? <ChevronUp className="w-5 h-5 text-green-600 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                  </button>
                  {openFaq === idx && (
                    <div className="p-5 pt-0 text-gray-600 leading-relaxed border-t border-gray-100 bg-gray-50/50">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Troubleshooting Section */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Wrench className="w-6 h-6 text-green-600" />
              <h2 className="text-2xl font-bold text-gray-900">Basic Troubleshooting</h2>
            </div>
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Clear Browser Cache</h3>
                <p className="text-gray-600 text-sm">If pages aren't loading correctly or you're seeing outdated information, try clearing your browser's cache and cookies, then reload the page.</p>
              </div>
              <div className="h-px bg-gray-100"></div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Check Network Connection</h3>
                <p className="text-gray-600 text-sm">ConnectEd requires a stable internet connection. If actions are timing out, check your Wi-Fi or cellular data connection.</p>
              </div>
              <div className="h-px bg-gray-100"></div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Update Your Browser</h3>
                <p className="text-gray-600 text-sm">For the best experience and security, ensure you are using the latest version of Chrome, Firefox, Safari, or Edge.</p>
              </div>
            </div>
          </section>

        </div>

        {/* Sidebar: Contact Info */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm text-center">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Still need help?</h3>
            <p className="text-gray-600 text-sm mb-6">If you couldn't find the answer to your question, our support team is ready to assist you.</p>
            <Link to="/contact" className="block w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors">
              Contact Support
            </Link>
          </div>

          <div className="bg-gray-100 p-6 rounded-3xl border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-500" />
              Response Time
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              We typically respond to support requests within <strong>24-48 hours</strong> during regular business days.
            </p>
            <p className="text-sm font-semibold text-gray-900">Direct Email:</p>
            <a href="mailto:support@connected-school.edu" className="text-green-600 text-sm hover:underline">support@connected-school.edu</a>
          </div>
        </div>

      </div>
      <Footer />
    </div>
  );
}

export { Support };
