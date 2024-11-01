import React, { useState, useEffect } from 'react';
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

interface Domain {
  id: number;
  companyName: string;
}

const CarbonClaims = () => {
  const { user } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [interventions, setInterventions] = useState([]);
  const [isClaimFormOpen, setIsClaimFormOpen] = useState(false);
  const [selectedIntervention, setSelectedIntervention] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [domain, setDomain] = useState<Domain | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    fetchClaims();
    fetchInterventions();
    fetchDomain();
  }, []);

  const fetchDomain = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/domains/${user.domainId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setDomain(data);
      }
    } catch (error) {
      console.error('Error fetching domain:', error);
    }
  };

  const fetchClaims = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/claims', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setClaims(data.data);
      }
    } catch (error) {
      console.error('Error fetching claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInterventions = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/intervention-requests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setInterventions(data);
      }
    } catch (error) {
      console.error('Error fetching interventions:', error);
    }
  };

  const handlePreviewStatement = async (claim: Claim) => {
    try {
      console.log('Attempting to preview claim:', {
        id: claim.id,
        interventionId: claim.interventionId
      });
  
      const response = await fetch(`http://localhost:3001/api/claims/${claim.id}/preview-statement`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        // Try to get error details
        try {
          const errorData = await response.json();
          console.error('Preview error details:', errorData);
        } catch {
          console.error('Preview error status:', response.status);
        }
        throw new Error('Failed to preview statement');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setIsPreviewModalOpen(true);
    } catch (error) {
      console.error('Error previewing statement:', error);
    }
  };

  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingPDF(true);
    
    try {
      const response = await fetch('http://localhost:3001/api/claims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          interventionId: selectedIntervention,
          amount: parseFloat(claimAmount),
          generateStatement: true // Tell backend to generate PDF statement
        })
      });
      
      if (response.ok) {
        const newClaim = await response.json();
        setClaims(prev => [...prev, newClaim.data]);
        setIsClaimFormOpen(false);
        setSelectedIntervention('');
        setClaimAmount('');
      }
    } catch (error) {
      console.error('Error creating claim:', error);
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleDownloadStatement = async (claim: Claim) => {
    if (!claim.statement?.pdfUrl) return;
    
    try {
      const response = await fetch(claim.statement.pdfUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `claim-statement-${claim.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading statement:', error);
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

            {/* Search and Filters */}
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

            {/* Claims List */}
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
                        className="border-t border-white/10 hover:bg-white/10 transition-colors duration-200">
                          <div className="font-medium">ID: {claim.intervention.interventionId}</div>
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
                                    >
                                    <Eye className="h-4 w-4" />
                                    </button>
                                    <button
                                    onClick={() => handleDownloadStatement(claim)}
                                    className="text-[#103D5E] hover:text-[#103D5E]/70 transition-colors duration-200"
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

                {/* Add preview modal */}
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

                {filteredClaims.length === 0 && (
                <div className="text-center py-8 text-[#103D5E]/60">
                    No claims found
                </div>
                )}
              </div>
            </div>

            {/* Claim Form Modal */}
            {isClaimFormOpen && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white/95 backdrop-blur-md rounded-xl p-6 w-full max-w-lg">
                  <h2 className="text-xl font-semibold text-[#103D5E] mb-4">New Carbon Claim</h2>
                  <form onSubmit={handleCreateClaim}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[#103D5E]/70 mb-1">
                          Intervention
                        </label>
                        <select
                          required
                          value={selectedIntervention}
                          onChange={(e) => setSelectedIntervention(e.target.value)}
                          className="w-full px-3 py-2 bg-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#103D5E]/50"
                        >
                          <option value="">Select intervention</option>
                          {interventions
                            .filter(intervention => intervention.status === 'verified')
                            .map((intervention) => {
                              // Calculate total amount already claimed for this intervention
                              const existingClaims = claims.filter(
                                claim => claim.intervention.interventionId === intervention.interventionId && claim.status === 'active'
                              );
                              const totalClaimed = existingClaims.reduce(
                                (sum, claim) => sum + claim.amount,
                                0
                              );
                              // Calculate remaining available amount
                              const available = intervention.emissionsAbated - totalClaimed;

                              return (
                                <option 
                                  key={intervention.id} 
                                  value={intervention.interventionId}
                                  disabled={available <= 0}
                                >
                                  ID: {intervention.interventionId} - {intervention.modality} - {available.toFixed(1)} tCO2e available
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
                          onChange={(e) => setClaimAmount(e.target.value)}
                          className="w-full px-3 py-2 bg-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#103D5E]/50"
                        />
                        {selectedIntervention && (
                          <p className="text-sm text-[#103D5E]/60 mt-1">
                            Available: {
                              (() => {
                                const intervention = interventions.find(i => i.interventionId === selectedIntervention);
                                if (!intervention) return 0;
                                
                                const existingClaims = claims.filter(
                                  claim => claim.intervention.interventionId === selectedIntervention && claim.status === 'active'
                                );
                                const totalClaimed = existingClaims.reduce(
                                  (sum, claim) => sum + claim.amount,
                                  0
                                );
                                return (intervention.emissionsAbated - totalClaimed).toFixed(1);
                              })()
                            } tCO2e
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-4 mt-6">
                      <button
                        type="button"
                        onClick={() => setIsClaimFormOpen(false)}
                        className="px-4 py-2 text-[#103D5E] hover:bg-white/20 rounded-lg transition-all duration-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#103D5E] text-white rounded-lg hover:bg-[#103D5E]/90 transition-all duration-300"
                      >
                        Create Claim
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Claims Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
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
          </div>
        </div>
      </div>
    </div>
  );
};

// Metric Card Component
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

export default CarbonClaims;