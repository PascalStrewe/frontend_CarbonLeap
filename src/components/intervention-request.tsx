import React, { useState } from 'react';
import { Check, AlertCircle, Ship, Truck, Plane, Train, Calendar, Info } from 'lucide-react';

const InterventionRequest = () => {
  const [formData, setFormData] = useState({
    clientName: '',
    modality: '',
    vintage: '',
    emissionReduction: '',
    additionality: '',
    causality: '',
    scope: '',
    certificationScheme: ''
  });
  
  const [submitted, setSubmitted] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const modalityIcons = {
    Maritime: Ship,
    Road: Truck,
    Air: Plane,
    Rail: Train
  };
  
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec] flex items-center justify-center p-4">
        <div className="bg-white/25 backdrop-blur-md rounded-xl shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] border border-white/20 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100/50 backdrop-blur-md mx-auto flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          
          <h2 className="mt-6 text-2xl font-bold text-[#103D5E]">
            Request Submitted Successfully
          </h2>
          
          <p className="mt-3 text-[#103D5E]/70">
            Your intervention request has been submitted. Would you like to:
          </p>
          
          <div className="mt-8 space-y-3">
            <button
              onClick={() => setSubmitted(false)}
              className="w-full bg-[#103D5E] text-white px-6 py-3 rounded-lg hover:bg-[#103D5E]/90 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Submit Another Request
            </button>
            
            <button
              onClick={() => window.location.href = '/'}
              className="w-full border border-white/20 bg-white/10 backdrop-blur-md text-[#103D5E] px-6 py-3 rounded-lg hover:bg-white/20 transition-all duration-300"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec] p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-[#103D5E] mb-6 flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          New Intervention Request
        </h1>
        
        <div className="bg-white/25 backdrop-blur-md rounded-xl shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] border border-white/20 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-[#103D5E] mb-1">
                  Client Name
                </label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                  className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E] placeholder-[#103D5E]/50 focus:border-[#B9D9DF] focus:outline-none focus:ring-1 focus:ring-[#B9D9DF] transition-colors duration-200"
                  required
                  placeholder="Enter client name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#103D5E] mb-1">
                  Modality
                </label>
                <select
                  value={formData.modality}
                  onChange={(e) => setFormData({...formData, modality: e.target.value})}
                  className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E] focus:border-[#B9D9DF] focus:outline-none focus:ring-1 focus:ring-[#B9D9DF] transition-colors duration-200"
                  required
                >
                  <option value="">Select modality...</option>
                  <option value="Maritime">Maritime</option>
                  <option value="Road">Road</option>
                  <option value="Air">Air</option>
                  <option value="Rail">Rail</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#103D5E] mb-1">
                  Vintage
                </label>
                <input
                  type="text"
                  value={formData.vintage}
                  onChange={(e) => setFormData({...formData, vintage: e.target.value})}
                  className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E] placeholder-[#103D5E]/50 focus:border-[#B9D9DF] focus:outline-none focus:ring-1 focus:ring-[#B9D9DF] transition-colors duration-200"
                  required
                  placeholder="YYYY"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#103D5E] mb-1">
                  Emission Reduction Sought
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.emissionReduction}
                    onChange={(e) => setFormData({...formData, emissionReduction: e.target.value})}
                    className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E] placeholder-[#103D5E]/50 focus:border-[#B9D9DF] focus:outline-none focus:ring-1 focus:ring-[#B9D9DF] transition-colors duration-200"
                    required
                    placeholder="Enter amount"
                  />
                  <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#103D5E]/50 text-sm">
                    tCO2e
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#103D5E] mb-1 flex items-center gap-1">
                  Additionality
                  <Info className="h-4 w-4 text-[#103D5E]/50" />
                </label>
                <select
                  value={formData.additionality}
                  onChange={(e) => setFormData({...formData, additionality: e.target.value})}
                  className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E] focus:border-[#B9D9DF] focus:outline-none focus:ring-1 focus:ring-[#B9D9DF] transition-colors duration-200"
                  required
                >
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#103D5E] mb-1 flex items-center gap-1">
                  Causality
                  <Info className="h-4 w-4 text-[#103D5E]/50" />
                </label>
                <select
                  value={formData.causality}
                  onChange={(e) => setFormData({...formData, causality: e.target.value})}
                  className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E] focus:border-[#B9D9DF] focus:outline-none focus:ring-1 focus:ring-[#B9D9DF] transition-colors duration-200"
                  required
                >
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#103D5E] mb-1">
                  Scope
                </label>
                <select
                  value={formData.scope}
                  onChange={(e) => setFormData({...formData, scope: e.target.value})}
                  className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E] focus:border-[#B9D9DF] focus:outline-none focus:ring-1 focus:ring-[#B9D9DF] transition-colors duration-200"
                  required
                >
                  <option value="">Select scope...</option>
                  <option value="scope1">Scope 1</option>
                  <option value="scope3">Scope 3</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#103D5E] mb-1">
                  Certification Scheme
                </label>
                <select
                  value={formData.certificationScheme}
                  onChange={(e) => setFormData({...formData, certificationScheme: e.target.value})}
                  className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E] focus:border-[#B9D9DF] focus:outline-none focus:ring-1 focus:ring-[#B9D9DF] transition-colors duration-200"
                  required
                >
                  <option value="">Select scheme...</option>
                  <option value="REDII">REDII</option>
                  <option value="GLEC">GLEC</option>
                </select>
              </div>
            </div>

            <div className="mt-8">
              <button
                type="submit"
                className="w-full bg-[#103D5E] text-white py-3 rounded-lg hover:bg-[#103D5E]/90 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                Submit Request
              </button>
            </div>
          </form>
          
          <div className="mt-6 bg-white/20 backdrop-blur-md rounded-lg p-4 flex items-start space-x-3 border border-white/20">
            <AlertCircle className="h-5 w-5 text-[#103D5E] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-[#103D5E]/70">
                Your request will be reviewed and matched with available interventions. 
                You will be notified when matching data is available in your dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterventionRequest;