// src/components/intervention-request.tsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, AlertCircle, Calendar, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Sidebar from './Sidebar';
import { useInterventions } from "../context/InterventionContext";
import Navigation from './Navigation';



// Type Definitions
type SubmissionStatusType = 'idle' | 'submitting' | 'success' | 'error';

interface SubmissionStatus {
  status: SubmissionStatusType;
  message: string;
}

interface FormData {
  intervention: string;
  modality: string;
  vesselType: string;
  geography: string;
  lowCarbonFuelLiters: string;
  lowCarbonFuelMT: string;
  scope3EmissionsAbated: string;
  ghgEmissionSaving: string;
  vintage: string;
  lowCarbonFuel: string;
  feedstock: string;
  causality: string;
  additionality: string;
  thirdPartyVerification: string;
  certificationScheme: string;
  otherCertificationScheme: string;
  standards: string;
  clientName: string;
}

interface PendingRequest extends FormData {
  id: string;
  submissionDate: string;
  status: string;
  userId?: number;
  companyDomain?: string;
}

const InterventionRequest = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const { refreshInterventions } = useInterventions();
  
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>({
    status: 'idle',
    message: ''
  });
  
  const [formData, setFormData] = useState<FormData>({
    intervention: 'Fuel Switch',
    modality: '',
    vesselType: '',
    geography: 'Europe',
    lowCarbonFuelLiters: '',
    lowCarbonFuelMT: '',
    scope3EmissionsAbated: '',
    ghgEmissionSaving: '85',
    vintage: currentYear.toString(),
    lowCarbonFuel: 'Biofuels',
    feedstock: '',
    causality: '',
    additionality: '',
    thirdPartyVerification: 'Yes',
    certificationScheme: '',
    otherCertificationScheme: '',
    standards: 'Book and Claim',
    clientName: user?.domain || 'Unknown Client'
  });

  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [showVesselType, setShowVesselType] = useState(false);
  const [showOtherCertification, setShowOtherCertification] = useState(false);

  const ghgOptions = Array.from({ length: 96 }, (_, i) => (95 - i).toString());

  useEffect(() => {
    setShowVesselType(formData.modality === 'Marine');
    setShowOtherCertification(formData.certificationScheme === 'Other');
  }, [formData.modality, formData.certificationScheme]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmissionStatus({
        status: 'submitting',
        message: 'Submitting your intervention request...'
      });

      // Validate required fields
      const requiredFields = ['modality', 'geography', 'additionality', 'causality'];
      const missingFields = requiredFields.filter(field => !formData[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Properly format and validate all fields
      const requestData = {
        userId: user?.id,
        clientName: user?.domain || 'Unknown Client',
        emissionsAbated: parseFloat(formData.scope3EmissionsAbated) || 0,
        date: new Date().toISOString(), // Fixed: Proper ISO date format
        interventionId: Math.random().toString(36).substr(2, 9),
        modality: formData.modality,
        geography: formData.geography,
        additionality: formData.additionality === 'Yes',
        causality: formData.causality === 'Yes',
        status: 'pending',
        deliveryTicketNumber: formData.deliveryTicketNumber || '',
        materialName: formData.materialName || '',
        materialId: formData.materialId || '',
        vendorName: formData.vendorName || '',
        quantity: parseFloat(formData.lowCarbonFuelLiters) || 0,
        unit: 'liters',
        amount: parseFloat(formData.lowCarbonFuelMT) || 0,
        lowCarbonFuel: formData.lowCarbonFuel || 'n/a',
        feedstock: formData.feedstock || 'n/a',
        certificationScheme: formData.certificationScheme || 'n/a',
        ghgEmissionSaving: formData.ghgEmissionSaving.toString(),
        vintage: parseInt(formData.vintage), // Fixed: Convert to number
        thirdPartyVerification: formData.thirdPartyVerification,
        standards: formData.standards || 'Book and Claim',
        // Optional fields with proper defaults
        otherCertificationScheme: formData.certificationScheme === 'Other' 
          ? formData.otherCertificationScheme 
          : undefined,
        vesselType: formData.modality === 'Marine' 
          ? formData.vesselType 
          : undefined
      };

      // Type validation
      if (isNaN(requestData.vintage)) {
        throw new Error('Invalid vintage year');
      }

      if (isNaN(requestData.emissionsAbated)) {
        throw new Error('Invalid emissions abated value');
      }

      console.log('Submitting request data:', requestData);

      const response = await fetch('http://localhost:3001/api/intervention-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit request');
      }

      const result = await response.json();
      console.log('Success response:', result);

      setPendingRequests(prev => [...prev, { 
        ...requestData, 
        id: result.requestId 
      } as PendingRequest]);

      // Refresh the intervention data
      refreshInterventions();

      setSubmissionStatus({
        status: 'success',
        message: 'Request submitted successfully'
      });
      
      setTimeout(() => setSubmitted(true), 1500);

    } catch (error) {
      console.error('Submission error:', error);
      setSubmissionStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to submit request. Please try again.'
      });
    }
  };
  
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec]">
        <Navigation />
        <div className="flex min-h-[calc(100vh-4rem)]">
          <Sidebar />
          <div className="flex-1 p-8">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white/25 backdrop-blur-md rounded-xl shadow-lg border border-white/20 p-8 mb-8">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100/50 backdrop-blur-md mx-auto flex items-center justify-center">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  
                  <h2 className="mt-6 text-2xl font-bold text-[#103D5E]">
                    Request Submitted Successfully
                  </h2>
                  
                  <p className="mt-4 text-[#103D5E]/70">
                    Your intervention request has been submitted and is now pending review. 
                    You will receive notifications about the status of your request.
                  </p>

                  <div className="mt-8 space-y-4">
                    <div className="bg-white/20 backdrop-blur-md rounded-lg p-4 text-left">
                      <h3 className="font-medium text-[#103D5E]">What happens next?</h3>
                      <ul className="mt-2 space-y-2 text-sm text-[#103D5E]/70">
                        <li>1. Our team will review your intervention request</li>
                        <li>2. We'll match your request with available interventions</li>
                        <li>3. You'll receive an email notification when matching data is available</li>
                        <li>4. You can track the status in your dashboard</li>
                      </ul>
                    </div>

                    <div className="space-x-4">
                      <button
                        onClick={() => navigate('/dashboard')}
                        className="bg-[#103D5E] text-white px-6 py-3 rounded-lg hover:bg-[#103D5E]/90 transition-all duration-300"
                      >
                        Go to Dashboard
                      </button>
                      
                      <button
                        onClick={() => {
                          setSubmitted(false);
                          setFormData({
                            intervention: 'Fuel Switch',
                            modality: '',
                            vesselType: '',
                            geography: 'Europe',
                            lowCarbonFuelLiters: '',
                            lowCarbonFuelMT: '',
                            scope3EmissionsAbated: '',
                            ghgEmissionSaving: '85',
                            vintage: currentYear.toString(),
                            lowCarbonFuel: 'Biofuels',
                            feedstock: '',
                            causality: '',
                            additionality: '',
                            thirdPartyVerification: 'Yes',
                            certificationScheme: '',
                            otherCertificationScheme: '',
                            standards: 'Book and Claim'
                          });
                        }}
                        className="border border-[#103D5E] text-[#103D5E] px-6 py-3 rounded-lg hover:bg-white/20 transition-all duration-300"
                      >
                        Submit Another Request
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {pendingRequests.length > 0 && (
                <div className="bg-white/25 backdrop-blur-md rounded-xl shadow-lg border border-white/20 p-8">
                  <h3 className="text-xl font-bold text-[#103D5E] mb-4">Recent Requests</h3>
                  <div className="space-y-4">
                    {pendingRequests.map((request: PendingRequest) => (
                      <div
                        key={request.id}
                        className="bg-white/20 backdrop-blur-md rounded-lg p-4 border border-white/20"
                      >
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-[#103D5E]/70">Request ID</p>
                            <p className="font-medium">#{request.id}</p>
                          </div>
                          <div>
                            <p className="text-sm text-[#103D5E]/70">Modality</p>
                            <p className="font-medium">{request.modality}</p>
                          </div>
                          <div>
                            <p className="text-sm text-[#103D5E]/70">Status</p>
                            <p className="font-medium text-amber-600">Pending Review</p>
                          </div>
                          <div>
                            <p className="text-sm text-[#103D5E]/70">Submitted</p>
                            <p className="font-medium">
                              {new Date(request.submissionDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec]">
      <Navigation />
      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-[#103D5E] mb-6 flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              New Intervention Request
            </h1>
            
            <div className="bg-white/25 backdrop-blur-md rounded-xl shadow-lg border border-white/20 p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Form fields section */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Intervention Type */}
                  <div>
                    <label className="block text-sm font-medium text-[#103D5E] mb-1">Intervention Type</label>
                    <input
                      type="text"
                      value={formData.intervention}
                      className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E]"
                      readOnly
                    />
                  </div>

                  {/* Modality */}
                  <div>
                    <label className="block text-sm font-medium text-[#103D5E] mb-1">Modality *</label>
                    <select
                      value={formData.modality}
                      onChange={(e) => setFormData({...formData, modality: e.target.value, vesselType: ''})}
                      className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E]"
                      required
                    >
                      <option value="">Select modality...</option>
                      <option value="Road">Road</option>
                      <option value="Marine">Marine</option>
                      <option value="Rail">Rail</option>
                      <option value="Air">Air</option>
                    </select>
                  </div>

                  {/* Vessel Type (conditional) */}
                  {showVesselType && (
                    <div>
                      <label className="block text-sm font-medium text-[#103D5E] mb-1">Vessel Type</label>
                      <input
                        type="text"
                        value={formData.vesselType}
                        onChange={(e) => setFormData({...formData, vesselType: e.target.value})}
                        className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E]"
                      />
                    </div>
                  )}

                  {/* Geography */}
                  <div>
                    <label className="block text-sm font-medium text-[#103D5E] mb-1">Geography *</label>
                    <input
                      type="text"
                      value={formData.geography}
                      onChange={(e) => setFormData({...formData, geography: e.target.value})}
                      className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E]"
                      required
                    />
                  </div>

                  {/* Low Carbon Fuel Liters */}
                  <div>
                    <label className="block text-sm font-medium text-[#103D5E] mb-1">Low Carbon Fuel (L)</label>
                    <input
                      type="number"
                      value={formData.lowCarbonFuelLiters}
                      onChange={(e) => setFormData({...formData, lowCarbonFuelLiters: e.target.value})}
                      className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E]"
                    />
                  </div>

                  {/* Low Carbon Fuel MT */}
                  <div>
                    <label className="block text-sm font-medium text-[#103D5E] mb-1">Low Carbon Fuel (MT)</label>
                    <input
                      type="number"
                      value={formData.lowCarbonFuelMT}
                      onChange={(e) => setFormData({...formData, lowCarbonFuelMT: e.target.value})}
                      className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E]"
                    />
                  </div>

                  {/* Scope 3 Emissions Abated */}
                  <div>
                    <label className="block text-sm font-medium text-[#103D5E] mb-1">Scope 3 Emissions Abated (tCO2)</label>
                    <input
                      type="number"
                      value={formData.scope3EmissionsAbated}
                      onChange={(e) => setFormData({...formData, scope3EmissionsAbated: e.target.value})}
                      className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E]"
                    />
                  </div>

                  {/* GHG Emission Saving */}
                  <div>
                    <label className="block text-sm font-medium text-[#103D5E] mb-1">GHG Emission Saving (%)</label>
                    <select
                      value={formData.ghgEmissionSaving}
                      onChange={(e) => setFormData({...formData, ghgEmissionSaving: e.target.value})}
                      className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E]"
                      required
                    >
                      {ghgOptions.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>

                  {/* Vintage */}
                  <div>
                    <label className="block text-sm font-medium text-[#103D5E] mb-1">Vintage (Year)</label>
                    <input
                      type="number"
                      min="2000"
                      max="2100"
                      value={formData.vintage}
                      onChange={(e) => setFormData({...formData, vintage: e.target.value})}
                      className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E]"
                      required
                    />
                  </div>

                  {/* Low Carbon Fuel */}
                  <div>
                    <label className="block text-sm font-medium text-[#103D5E] mb-1">Low Carbon Fuel *</label>
                    <select
                      value={formData.lowCarbonFuel}
                      onChange={(e) => setFormData({...formData, lowCarbonFuel: e.target.value})}
                      className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E]"
                      required
                    >
                      <option value="Biofuels">Biofuels</option>
                      <option value="Bio-LNG">Bio-LNG</option>
                      <option value="Ammonia">Ammonia</option>
                      <option value="Bio-Methanol">Bio-Methanol</option>
                      <option value="Bio-Ethanol">Bio-Ethanol</option>
                      <option value="E-Fuels">E-Fuels</option>
                      <option value="Biogas">Biogas</option>
                      <option value="HVO100">HVO100</option>
                    </select>
                  </div>

                  {/* Feedstock */}
                  <div>
                    <label className="block text-sm font-medium text-[#103D5E] mb-1">Feedstock *</label>
                    <select
                      value={formData.feedstock}
                      onChange={(e) => setFormData({...formData, feedstock: e.target.value})}
                      className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E]"
                      required
                    >
                      <option value="">Select feedstock...</option>
                      <option value="Annex IX Part A or B">Annex IX Part A or B</option>
                      <option value="Annex IX Part A or B, non-POME">Annex IX Part A or B, non-POME</option>
                      <option value="Annex IX Part A or B, non-food">Annex IX Part A or B, non-food</option>
                      <option value="n/a">n/a</option>
                    </select>
                  </div>

                  {/* Causality */}
                  <div>
                    <label className="block text-sm font-medium text-[#103D5E] mb-1">Causality *</label>
                    <select
                      value={formData.causality}
                      onChange={(e) => setFormData({...formData, causality: e.target.value})}
                      className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E]"
                      required
                    >
                      <option value="">Select...</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  {/* Additionality */}
                  <div>
                    <label className="block text-sm font-medium text-[#103D5E] mb-1">Additionality *</label>
                    <select
                      value={formData.additionality}
                      onChange={(e) => setFormData({...formData, additionality: e.target.value})}
                      className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E]"
                      required
                    >
                      <option value="">Select...</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  {/* Third Party Verification */}
                  <div>
                    <label className="block text-sm font-medium text-[#103D5E] mb-1">Third Party Verification</label>
                    <input
                      type="text"
                      value={formData.thirdPartyVerification}
                      className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E]"
                      readOnly
                    />
                  </div>

                  {/* Certification Scheme */}
                  <div>
                    <label className="block text-sm font-medium text-[#103D5E] mb-1">Certification Scheme *</label>
                    <select
                      value={formData.certificationScheme}
                      onChange={(e) => setFormData({...formData, certificationScheme: e.target.value})}
                      className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E]"
                      required
                    >
                      <option value="">Select scheme...</option>
                      <option value="REDII">REDII</option>
                      <option value="GLEC">GLEC</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Other Certification Scheme (conditional) */}
                  {showOtherCertification && (
                    <div>
                      <label className="block text-sm font-medium text-[#103D5E] mb-1">Specify Other Scheme *</label>
                      <input
                        type="text"
                        value={formData.otherCertificationScheme}
                        onChange={(e) => setFormData({...formData, otherCertificationScheme: e.target.value})}
                        className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E]"
                        required={showOtherCertification}
                      />
                    </div>
                  )}

                  {/* Standards */}
                  <div>
                    <label className="block text-sm font-medium text-[#103D5E] mb-1">Standards</label>
                    <input
                      type="text"
                      value={formData.standards}
                      className="block w-full rounded-lg border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-[#103D5E]"
                      readOnly
                    />
                  </div>
                </div>

                <div className="mt-8">
                  <button
                    type="submit"
                    disabled={submissionStatus.status === 'submitting'}
                    className="w-full bg-[#103D5E] text-white py-3 rounded-lg hover:bg-[#103D5E]/90 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submissionStatus.status === 'submitting' && (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    )}
                    {submissionStatus.status === 'submitting' ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
              
              <div className="mt-6 bg-white/20 backdrop-blur-md rounded-lg p-4 flex items-start space-x-3 border border-white/20">
                <AlertCircle className="h-5 w-5 text-[#103D5E] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-[#103D5E]/70">
                    Fields marked with * are required. Either Low Carbon Fuel amount or Scope 3 Emissions must be provided.
                    Your request will be reviewed and matched with available interventions.
                    You will be notified when matching data is available in your dashboard.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {submissionStatus.status !== 'idle' && (
            <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${
              submissionStatus.status === 'error' ? 'bg-red-100 text-red-700' :
              submissionStatus.status === 'success' ? 'bg-green-100 text-green-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              <div className="flex items-center gap-2">
                {submissionStatus.status === 'submitting' && (
                  <Loader2 className="h-5 w-5 animate-spin" />
                )}
                {submissionStatus.message}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterventionRequest;
