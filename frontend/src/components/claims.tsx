import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useInterventions } from '../context/InterventionContext';
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
    totalAmount: number;
    claimedAmount?: number;
  };
  amount: number;
  vintage: number;
  expiryDate: Date;
  status: string;
  statement?: ClaimStatement;
  supplyChainLevel: number;
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
  // Context hooks
  const { user } = useAuth();
  const { interventionData, refreshInterventions } = useInterventions();

  // State declarations
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

  // Auto-refresh effect
  useEffect(() => {
    if (refreshInterventions) {
      refreshInterventions();
      const interval = setInterval(refreshInterventions, 5000);
      return () => clearInterval(interval);
    }
  }, [refreshInterventions]);

  const fetchClaims = useCallback(async () => {
    if (!user?.domain) return;
    
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Not authenticated');
      return;
    }
  
    try {
      const response = await fetch('/api/claims', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch claims');
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

  // Transform and set interventions
  useEffect(() => {
    if (interventionData && interventionData.length > 0) {
      const transformed = interventionData
        .filter((intervention: any) => intervention.emissionsAbated > 0)
        .map((intervention: any): Intervention => ({
          id: intervention.id,
          interventionId: intervention.interventionId,
          clientName: intervention.clientName || 'Unknown Client',
          emissionsAbated: parseFloat(intervention.emissionsAbated) || 0,
          date: typeof intervention.date === 'string' 
            ? intervention.date 
            : new Date(intervention.date).toLocaleDateString(),
          modality: intervention.modality || 'Unknown',
          geography: intervention.geography || 'Unknown',
          additionality: intervention.additionality ? 'Yes' : 'No',
          causality: intervention.causality ? 'Yes' : 'No',
          status: intervention.status ? intervention.status.toLowerCase().trim() : 'unknown'
        }));
      setInterventions(transformed);
    }
  }, [interventionData]);

  useEffect(() => {
    if (user?.domain) {
      fetchClaims();
    }
  }, [user?.domain, refreshTrigger, fetchClaims]);

  const calculateAvailableAmount = useCallback((interventionId: string): number => {
    const intervention = interventions.find(i => i.interventionId === interventionId);
    if (!intervention) return 0;
  
    // Don't allow claims on outgoing transfers
    if (intervention.modality?.toLowerCase().includes('transfer to')) {
      return 0;
    }
  
    // Get existing claim amount at this level
    const existingClaimAmountAtLevel = claims.reduce(
      (sum, claim) => 
        claim.intervention.interventionId === interventionId && 
        claim.supplyChainLevel === user?.domain?.supplyChainLevel &&
        claim.status === 'active' 
          ? sum + claim.amount 
          : sum,
      0
    );
  
    const emissionsAmount = typeof intervention.emissionsAbated === 'string' 
      ? parseFloat(intervention.emissionsAbated) 
      : intervention.emissionsAbated;
  
    // If we've claimed the full intervention amount at this level, no more claiming is allowed
    if (existingClaimAmountAtLevel >= emissionsAmount) {
      return 0;
    }
  
    // Calculate total claimed across all levels
    const totalClaimed = claims.reduce(
      (sum, claim) => claim.intervention.interventionId === interventionId && 
                     claim.status === 'active' ? sum + claim.amount : sum,
      0
    );
  
    // Return the minimum of:
    // 1. What's left to claim at this level
    // 2. What's left to claim overall
    return Math.min(
      emissionsAmount - existingClaimAmountAtLevel,
      emissionsAmount - totalClaimed
    );
  }, [claims, interventions, user?.domain?.supplyChainLevel]);

  const availableInterventions = useMemo(() => 
    interventions.filter(intervention => {
      // Must be verified
      const isVerified = intervention.status.toLowerCase().trim() === 'verified';
      
      // Must have available amount
      const hasAvailable = calculateAvailableAmount(intervention.interventionId) > 0;
      
      // Must not be an outgoing transfer
      const isNotOutgoingTransfer = !intervention.modality?.toLowerCase().includes('transfer to');
      
      return isVerified && hasAvailable && isNotOutgoingTransfer;
    }),
    [interventions, calculateAvailableAmount]
  );

  const handlePreviewStatement = async (claim: Claim) => {
    try {
      const response = await fetch(`/api/claims/${claim.id}/preview-statement`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Accept': 'application/pdf',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        throw new Error('Received invalid content type from server');
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

      // Validate user's supply chain level exists
      if (!user?.domain?.supplyChainLevel) {
        throw new Error('Could not determine your supply chain level. Please contact support.');
      }

      // Calculate existing claim amount at this level
      const existingClaimAmountAtLevel = claims.reduce(
        (sum, claim) => 
          claim.intervention.interventionId === selectedIntervention && 
          claim.supplyChainLevel === user?.domain?.supplyChainLevel &&
          claim.status === 'active' 
            ? sum + claim.amount 
            : sum,
        0
      );

      // Get intervention total amount
      const intervention = interventions.find(i => i.interventionId === selectedIntervention);
      if (!intervention) {
        throw new Error('Selected intervention not found');
      }

      const emissionsAmount = typeof intervention.emissionsAbated === 'string' 
        ? parseFloat(intervention.emissionsAbated) 
        : intervention.emissionsAbated;

      // Check if attempting to claim more than available at this level
      if (existingClaimAmountAtLevel + parseFloat(claimAmount) > emissionsAmount) {
        throw new Error(`Cannot claim more than available amount at your supply chain level (${(emissionsAmount - existingClaimAmountAtLevel).toFixed(2)} tCO2e)`);
      }

      const availableAmount = calculateAvailableAmount(selectedIntervention);
      if (parseFloat(claimAmount) > availableAmount) {
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
          amount: amount,
          supplyChainLevel: user?.domain?.supplyChainLevel
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

      // Refresh data after successful claim
      if (refreshInterventions) {
        refreshInterventions();
        setTimeout(refreshInterventions, 1000);
      }
    } catch (error) {
      console.error('Error creating claim:', error);
      setError(error instanceof Error ? error.message : 'Failed to create claim');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleDownloadStatement = async (claim: Claim) => {
    if (!claim.statement?.pdfUrl) {
      setError('No statement available for this claim');
      return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Not authenticated');
      return;
    }
  
    try {
      setError(null);
      const response = await fetch(claim.statement.pdfUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/pdf',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
  
      if (!response.ok) {
        console.error('Server response not OK:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        throw new Error(`Failed to download statement (${response.status})`);
      }
  
      const blob = await response.blob();
      const filename = `claim-statement-${claim.id}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setTimeout(() => URL.revokeObjectURL(url), 100);
  
    } catch (error) {
      console.error('Error downloading statement:', error);
      setError(error instanceof Error ? error.message : 'Failed to download statement');
    }
  };

  const filteredClaims = useMemo(() => 
    claims.filter(claim => 
      claim.intervention.modality.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.intervention.geography.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [claims, searchTerm]
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
                    <th className="px-4 py-2 text-left">Supply Chain Level</th>
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
                          Level {claim.supplyChainLevel}
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