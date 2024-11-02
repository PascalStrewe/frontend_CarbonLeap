import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shield, 
  FileCheck, 
  Clock, 
  Download,
  AlertTriangle,
  Plus,
  Search,
  Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Navigation from './Navigation';

interface ClaimStatement {
  id: string;
  pdfUrl: string;
  templateVersion: string;
  createdAt: Date;
}

interface Claim {
  id: string;
  intervention: {
    modality: string;
    geography: string;
    interventionId: string;
    certificationScheme: string;
    vintage: number;
  };
  amount: number;
  vintage: number;
  expiryDate: Date;
  status: string;
  statement?: ClaimStatement;
}

interface Intervention {
  id: string;
  interventionId: string;
  clientName: string;
  emissionsAbated: number;
  date: string;
  modality: string;
  geography: string;
  additionality: string;
  causality: string;
  status: string;
}

interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  unit: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, title, value, unit }) => (
  <div className="bg-white/25 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] transition-all duration-300 hover:translate-y-[-4px] hover:shadow-xl group">
    <div className="flex items-start justify-between">
      <h3 className="text-[#103D5E]/60 text-sm font-medium">{title}</h3>
      <div className="p-2 bg-white/30 rounded-lg group-hover:bg-white/40 transition-colors duration-300">
        {icon}
      </div>
    </div>
    <div className="mt-4 flex items-end space-x-2">
      <div className="text-3xl font-bold text-[#103D5E]">{value}</div>
      <div className="text-sm text-[#103D5E]/60 mb-1">{unit}</div>
    </div>
  </div>
);

const CarbonClaims = () => {
  const { user } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [isClaimFormOpen, setIsClaimFormOpen] = useState(false);
  const [selectedIntervention, setSelectedIntervention] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchClaims = useCallback(async () => {
    if (!user?.domain) return;
    
    try {
      const response = await fetch('/api/claims', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
  
      if (!response.ok) {
        throw new Error('Failed to fetch claims');
      }
      const data = await response.json();
      if (data.success) {
        setClaims(data.data);
      } else {
        throw new Error(data.message || 'Failed to fetch claims');
      }
    } catch (error) {
      console.error('Error fetching claims:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch claims');
    } finally {
      setLoading(false);
    }
  }, [user?.domain]);
  
  const fetchInterventions = useCallback(async () => {
    if (!user?.domain) return;
    
    try {
      const response = await fetch('/api/intervention-requests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch interventions');
      }
      
      const data = await response.json();
      
      const transformedInterventions = data
        .filter((intervention: any) => intervention.emissionsAbated > 0)
        .map((intervention: any): Intervention => ({
          id: intervention.id,
          interventionId: intervention.interventionId,
          clientName: intervention.clientName || 'Unknown Client',
          emissionsAbated: parseFloat(intervention.emissionsAbated) || 0,
          date: typeof intervention.date === 'string' ? intervention.date : new Date(intervention.date).toLocaleDateString(),
          modality: intervention.modality || 'Unknown',
          geography: intervention.geography || 'Unknown',
          additionality: intervention.additionality ? 'Yes' : 'No',
          causality: intervention.causality ? 'Yes' : 'No',
          status: (intervention.status || 'unknown').toLowerCase()
        }));
  
      setInterventions(transformedInterventions);
    } catch (error) {
      console.error('Error fetching interventions:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch interventions');
    }
  }, [user?.domain]);

  useEffect(() => {
    if (user?.domain) {
      fetchClaims();
      fetchInterventions();
    }
  }, [user?.domain, refreshTrigger, fetchClaims, fetchInterventions]);

  const calculateAvailableAmount = useCallback((interventionId: string): number => {
    const intervention = interventions.find(i => i.interventionId === interventionId);
    if (!intervention) return 0;

    const existingClaims = claims.filter(
      claim => claim.intervention.interventionId === interventionId && claim.status === 'active'
    );
    
    const totalClaimed = existingClaims.reduce(
      (sum, claim) => sum + claim.amount,
      0
    );

    return intervention.emissionsAbated - totalClaimed;
  }, [claims, interventions]);

  const availableInterventions = interventions.filter(
    intervention => calculateAvailableAmount(intervention.interventionId) > 0
  );

  const handlePreviewStatement = async (claim: Claim) => {
    try {
      const response = await fetch(`/api/claims/${claim.id}/preview-statement`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to preview statement');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setIsPreviewModalOpen(true);
    } catch (error) {
      console.error('Error previewing statement:', error);
      setError(error instanceof Error ? error.message : 'Failed to preview statement');
    }
  };

  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingPDF(true);
    setError(null);
    
    try {
      if (!selectedIntervention || !claimAmount) {
        throw new Error('Please fill in all required fields');
      }

      const amount = parseFloat(claimAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid amount');
      }

      const availableAmount = calculateAvailableAmount(selectedIntervention);
      if (amount > availableAmount) {
        throw new Error(`Cannot claim more than available amount (${availableAmount.toFixed(2)} tCO2e)`);
      }

      const response = await fetch('/api/claims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          interventionId: selectedIntervention,
          amount: amount
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to create claim');
      }

      setIsClaimFormOpen(false);
      setSelectedIntervention('');
      setClaimAmount('');
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error creating claim:', error);
      setError(error instanceof Error ? error.message : 'Failed to create claim');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleDownloadStatement = async (claim: Claim) => {
    if (!claim.statement?.pdfUrl) return;
    
    try {
      const response = await fetch(claim.statement.pdfUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to download statement');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `claim-statement-${claim.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading statement:', error);
      setError(error instanceof Error ? error.message : 'Failed to download statement');
    }
  };

  const filteredClaims = claims.filter(claim => 
    claim.intervention.modality.toLowerCase().includes(searchTerm.toLowerCase()) ||
    claim.intervention.geography.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec]">
      <Navigation />
      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-2xl font-bold text-[#103D5E]">Carbon Claims Management</h1>
              <button
                onClick={() => setIsClaimFormOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#103D5E] text-white rounded-lg hover:bg-[#103D5E]/90 transition-all duration-300"
              >
                <Plus className="h-5 w-5" />
                New Claim
              </button>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                {error}
              </div>
            )}

            {/* Claims Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <MetricCard 
                title="Total Claimed"
                value={claims.reduce((sum, claim) => 
                  claim.status === 'active' ? sum + claim.amount : sum, 
                  0
                ).toFixed(1)}
                unit="tCO2e"
                icon={<Shield className="h-6 w-6 text-[#103D5E]" />}
              />
              <MetricCard 
                title="Active Claims"
                value={claims.filter(claim => 
                  claim.status === 'active' && new Date(claim.expiryDate) > new Date()
                ).length}
                unit="claims"
                icon={<FileCheck className="h-6 w-6 text-[#103D5E]" />}
              />
              <MetricCard 
                title="Expiring Soon"
                value={claims.filter(claim => {
                  const expiryDate = new Date(claim.expiryDate);
                  const threeMonthsFromNow = new Date();
                  threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
                  return claim.status === 'active' && 
                         expiryDate > new Date() && 
                         expiryDate <= threeMonthsFromNow;
                }).length}
                unit="claims"
                icon={<Clock className="h-6 w-6 text-[#103D5E]" />}
              />
              <MetricCard 
                title="Expired Claims"
                value={claims.filter(claim => 
                  new Date(claim.expiryDate) <= new Date()
                ).length}
                unit="claims"
                icon={<AlertTriangle className="h-6 w-6 text-[#103D5E]" />}
              />
            </div>

            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#103D5E]/60" />
                <input
                  type="text"
                  placeholder="Search claims..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full md:w-80 bg-white/25 backdrop-blur-md border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#103D5E]/50"
                />
              </div>
            </div>

            {/* Claims Table */}
            <div className="bg-white/25 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[#103D5E]/70 text-sm">
                      <th className="px-4 py-2 text-left">Intervention</th>
                      <th className="px-4 py-2 text-left">Amount</th>
                      <th className="px-4 py-2 text-left">Vintage</th>
                      <th className="px-4 py-2 text-left">Expiry</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Statement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClaims.map((claim) => (
                      <tr 
                        key={claim.id}
                        className="border-t border-white/10 hover:bg-white/10 transition-colors duration-200"
                      >
                        <td className="px-4 py-3 text-[#103D5E]">
                          <div className="font-medium">ID: {claim.intervention.interventionId}</div>
                          <div className="text-sm text-[#103D5E]/60">
                            {claim.intervention.geography}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#103D5E]">
                          {claim.amount.toFixed(2)} tCO2e
                        </td>
                        <td className="px-4 py-3 text-[#103D5E]">
                          {claim.vintage}
                        </td>
                        <td className="px-4 py-3 text-[#103D5E]">
                          {new Date(claim.expiryDate).toLocaleDateString()}
                          {new Date(claim.expiryDate) < new Date() && (
                            <div className="text-red-500 text-sm flex items-center gap-1">
                              <AlertTriangle className="h-4 w-4" />
                              Expired
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-sm ${
                            claim.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {claim.statement ? (
                              <>
                                <button
                                  onClick={() => handlePreviewStatement(claim)}
                                  className="text-[#103D5E] hover:text-[#103D5E]/70 transition-colors duration-200"
                                  title="Preview Statement"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDownloadStatement(claim)}
                                  className="text-[#103D5E] hover:text-[#103D5E]/70 transition-colors duration-200"
                                  title="Download Statement"
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <span className="text-sm text-[#103D5E]/60">
                                Generating...
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredClaims.length === 0 && !loading && (
                  <div className="text-center py-8 text-[#103D5E]/60">
                    No claims found
                  </div>
                )}

                {loading && (
                  <div className="text-center py-8 text-[#103D5E]/60">
                    Loading claims...
                  </div>
                )}
              </div>
            </div>

            {/* New Claim Modal */}
            {isClaimFormOpen && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white/95 backdrop-blur-md rounded-xl p-6 w-full max-w-lg">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-[#103D5E]">New Carbon Claim</h2>
                    <button
                      onClick={() => {
                        setIsClaimFormOpen(false);
                        setError(null);
                      }}
                      className="text-[#103D5E]/60 hover:text-[#103D5E] transition-colors"
                    >
                      ×
                    </button>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleCreateClaim} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#103D5E]/70 mb-1">
                        Intervention
                      </label>
                      <select
                        required
                        value={selectedIntervention}
                        onChange={(e) => {
                          setSelectedIntervention(e.target.value);
                          setError(null);
                        }}
                        disabled={generatingPDF}
                        className="w-full px-3 py-2 bg-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#103D5E]/50 disabled:opacity-50"
                      >
                        <option value="">Select intervention</option>
                        {availableInterventions.map((intervention) => {
                          const available = calculateAvailableAmount(intervention.interventionId);
                          return (
                            <option 
                              key={intervention.interventionId} 
                              value={intervention.interventionId}
                            >
                              {intervention.modality} - {intervention.geography} ({available.toFixed(1)} tCO2e available)
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#103D5E]/70 mb-1">
                        Amount to Claim (tCO2e)
                      </label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0.01"
                        value={claimAmount}
                        onChange={(e) => {
                          setClaimAmount(e.target.value);
                          setError(null);
                        }}
                        disabled={generatingPDF}
                        className="w-full px-3 py-2 bg-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#103D5E]/50 disabled:opacity-50"
                      />
                      {selectedIntervention && (
                        <p className="text-sm text-[#103D5E]/60 mt-1">
                          Available: {calculateAvailableAmount(selectedIntervention).toFixed(1)} tCO2e
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end gap-4 mt-6">
                      <button
                        type="button"
                        onClick={() => {
                          setIsClaimFormOpen(false);
                          setError(null);
                        }}
                        disabled={generatingPDF}
                        className="px-4 py-2 text-[#103D5E] hover:bg-white/20 rounded-lg transition-all duration-300 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={generatingPDF}
                        className="px-4 py-2 bg-[#103D5E] text-white rounded-lg hover:bg-[#103D5E]/90 transition-all duration-300 disabled:opacity-50 flex items-center gap-2"
                      >
                        {generatingPDF ? (
                          <>
                            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                            Processing...
                          </>
                        ) : (
                          'Create Claim'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Preview Modal */}
            {isPreviewModalOpen && previewUrl && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-4xl h-[80vh] flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-[#103D5E]">Statement Preview</h2>
                    <button
                      onClick={() => {
                        setIsPreviewModalOpen(false);
                        URL.revokeObjectURL(previewUrl);
                      }}
                      className="text-[#103D5E] hover:text-[#103D5E]/70"
                    >
                      ×
                    </button>
                  </div>
                  <iframe
                    src={previewUrl}
                    className="flex-1 w-full rounded-lg border border-gray-200"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CarbonClaims;