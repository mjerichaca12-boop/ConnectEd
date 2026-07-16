import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { Footer } from "../components/Footer";
import { Mail, Phone, MapPin, Clock, Send, CheckCircle2 } from "lucide-react";

function ContactUs() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  
  const [status, setStatus] = useState("idle"); // idle, loading, success, error
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    // Simple validation
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      setStatus("error");
      setErrorMessage("Please fill out all fields before submitting.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      setStatus("error");
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    // Simulate network request
    setTimeout(() => {
      setStatus("success");
      setFormData({ name: "", email: "", subject: "", message: "" });
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      <div className="flex-grow flex items-center justify-center px-6 py-24 md:py-32">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
          
          {/* Left Column: Contact Info */}
          <div className="flex flex-col justify-center space-y-8 p-6 md:p-8 bg-white rounded-3xl border border-gray-200 shadow-xl">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Get in Touch</h1>
              <p className="text-gray-600 leading-relaxed">
                We're here to help! Whether you have a question about the platform, need technical support, or just want to provide feedback, reach out to us using the contact details below.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-green-50 rounded-xl">
                  <MapPin className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">School Address</h3>
                  <p className="text-gray-600 mt-1">123 Education Boulevard<br />Learning City, ED 12345</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-green-50 rounded-xl">
                  <Mail className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Email Us</h3>
                  <p className="text-gray-600 mt-1">support@connected-school.edu</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-green-50 rounded-xl">
                  <Phone className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Phone Number</h3>
                  <p className="text-gray-600 mt-1">+1 (555) 123-4567</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-green-50 rounded-xl">
                  <Clock className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Office Hours</h3>
                  <p className="text-gray-600 mt-1">Monday - Friday: 8:00 AM - 5:00 PM<br />Saturday & Sunday: Closed</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-10 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Send us a Message</h2>
            
            {status === "success" ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Message Sent!</h3>
                <p className="text-gray-600 max-w-sm">Thank you for reaching out. Our support team will get back to you as soon as possible.</p>
                <button onClick={() => setStatus("idle")} className="mt-4 px-6 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors">
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {status === "error" && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                    <p className="text-sm text-red-600 font-medium">{errorMessage}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="John Doe" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">Email Address</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="john@example.com" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-all" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Subject</label>
                  <input type="text" name="subject" value={formData.subject} onChange={handleChange} placeholder="How can we help?" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-all" />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Message</label>
                  <textarea name="message" value={formData.message} onChange={handleChange} rows={5} placeholder="Write your message here..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-all resize-none"></textarea>
                </div>

                <button type="submit" disabled={status === "loading"} className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed">
                  {status === "loading" ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
      <Footer />
    </div>
  );
}

export { ContactUs };
