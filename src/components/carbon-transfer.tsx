import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeftRight, 
  CheckCircle2, 
  Clock, 
  Search,
  FileText,
  Building,
  Filter,
  X,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInterventions } from '../context/InterventionContext';
import Sidebar from './Sidebar';
import Navigation from './Navigation';


interface Domain {
  id: number;
  name: string;
  companyName: string;
}

interface Transfer {
  id: string;
  sourceIntervention: {
    id: string;
    modality: string;
    scope3EmissionsAbated: string;
  };
  sourceDomain: {
    name: string;
    companyName: string;
  };
  targetDomain: {
    name: string;
    companyName: string;
  };
  amount: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
  notes?: string;
}

interface TransferFormData {
  interventionId: string;
  targetDomainId: number;
  amount: string;
  notes?: string;
}

const TransferStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStatusStyles = () => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <span className={`px-2 py-1 rounded-full text-sm ${getStatusStyles()}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const TransferActions: React.FC<{
  transfer: Transfer;
  onApprove: () => void;
  onReject: () => void;
}> = ({ transfer, onApprove, onReject }) => {
  const { user } = useAuth();
  
  // Debug logging
  console.log('Transfer:', transfer);
  console.log('User domain:', user?.domain);
  
  // Check if user is the target domain and transfer is pending
  const isTargetDomain = transfer.targetDomain.name.replace('@', '') === user?.domain?.replace('@', '');
  const isPending = transfer.status === 'pending';

  if (!isPending || !isTargetDomain) {
    return null;
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={onApprove}
        className="p-1 text-green-600 hover:bg-green-50 rounded"
        title="Approve Transfer"
      >
        <CheckCircle2 className="h-5 w-5" />
      </button>
      <button
        onClick={onReject}
        className="p-1 text-red-600 hover:bg-red-50 rounded"
        title="Reject Transfer"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
};

const CarbonTransfer: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { interventionData, refreshInterventions } = useInterventions();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [tradingPartners, setTradingPartners] = useState<Domain[]>([]);
  const [isTransferFormOpen, setIsTransferFormOpen] = useState(false);
  const [formData, setFormData] = useState<TransferFormData>({
    interventionId: '',
    targetDomainId: 0,
    amount: '',
    notes: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available trading partners
  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const response = await fetch('/api/trading-partners', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setTradingPartners(data);
        }
      } catch (error) {
        console.error('Error fetching trading partners:', error);
      }
    };
    fetchPartners();
  }, []);

  // Fetch transfers
  useEffect(() => {
    const fetchTransfers = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/transfers', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setTransfers(data);
        }
      } catch (error) {
        console.error('Error fetching transfers:', error);
      }
    };
    
    fetchTransfers();
    const interval = setInterval(fetchTransfers, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create transfer');
      }
      
      const newTransfer = await response.json();
      setTransfers(prev => [...prev, newTransfer]);
      setIsTransferFormOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create transfer');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveTransfer = async (transferId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/transfers/${transferId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const updatedTransfer = await response.json();
        
        // Update the transfers list with the new status
        setTransfers(prev => 
          prev.map(t => t.id === updatedTransfer.id ? updatedTransfer : t)
        );
  
        // Update intervention data to reflect the transfer
        const response = await fetch(`http://localhost:3001/api/intervention-requests/${updatedTransfer.sourceIntervention.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            emissionsAbated: (
              parseFloat(updatedTransfer.sourceIntervention.scope3EmissionsAbated) - 
              parseFloat(updatedTransfer.amount)
            ).toString()
          })
        });
  
        if (!response.ok) {
          throw new Error('Failed to update intervention credits');
        }
  
        // Create a new intervention for the target company
        const createResponse = await fetch('http://localhost:3001/api/intervention-requests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            modality: `Transfer from ${updatedTransfer.sourceDomain.name}`,
            emissionsAbated: updatedTransfer.amount,
            date: new Date().toLocaleDateString(),
            status: 'verified',
            clientName: updatedTransfer.targetDomain.companyName,
            additionality: true,
            causality: true,
            geography: updatedTransfer.sourceIntervention.geography || 'Transfer',
            lowCarbonFuel: updatedTransfer.sourceIntervention.lowCarbonFuel || 'N/A',
            feedstock: updatedTransfer.sourceIntervention.feedstock || 'N/A',
            certificationScheme: updatedTransfer.sourceIntervention.certificationScheme || 'N/A',
            ghgEmissionSaving: updatedTransfer.sourceIntervention.ghgEmissionSaving || 'N/A',
            vintage: new Date().getFullYear(),
            thirdPartyVerification: 'Transfer Verified',
            transferId: transferId
          })
        });
  
        if (!createResponse.ok) {
          throw new Error('Failed to create intervention for target company');
        }
  
        // Refresh intervention data in context
        await refreshInterventions();
      }
    } catch (error) {
      console.error('Error approving transfer:', error);
    }
  };

  const handleRejectTransfer = async (transferId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/transfers/${transferId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const updatedTransfer = await response.json();
        setTransfers(prev => 
          prev.map(t => t.id === updatedTransfer.id ? updatedTransfer : t)
        );
      }
    } catch (error) {
      console.error('Error rejecting transfer:', error);
    }
  };

  // Filter transfers based on search and status
  const filteredTransfers = transfers.filter(transfer => {
    const matchesSearch = 
      transfer.sourceDomain.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.targetDomain.companyName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || transfer.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handlePartnershipSetup = () => {
    navigate('/partnerships');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec]">
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Action Buttons */}
            <div className="flex justify-between mb-8">
              <button
                onClick={() => setIsTransferFormOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#103D5E] text-white rounded-lg hover:bg-[#103D5E]/90 transition-all duration-300"
              >
                <ArrowLeftRight className="h-5 w-5" />
                New Transfer
              </button>
              
              {/* Search and Filter */}
              <div className="flex gap-4">
                <div className="relative">
                  <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#103D5E]/60" />
                  <input
                    type="text"
                    placeholder="Search companies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-white/25 backdrop-blur-md border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#103D5E]/50"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 bg-white/25 backdrop-blur-md border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#103D5E]/50"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Transfer History */}
            <div className="bg-white/25 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] mb-8">
              <h2 className="text-xl font-semibold text-[#103D5E] mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Transfer History
              </h2>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[#103D5E]/70 text-sm">
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">From</th>
                      <th className="px-4 py-2 text-left">To</th>
                      <th className="px-4 py-2 text-left">Intervention</th>
                      <th className="px-4 py-2 text-left">Amount</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransfers.map((transfer) => (
                      <tr 
                        key={transfer.id}
                        className="border-t border-white/10 hover:bg-white/10 transition-colors duration-200"
                      >
                        <td className="px-4 py-3 text-[#103D5E]">
                          {new Date(transfer.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-[#103D5E]">
                          {transfer.sourceDomain.companyName}
                          <div className="text-sm text-[#103D5E]/60">
                            {transfer.sourceDomain.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#103D5E]">
                          {transfer.targetDomain.companyName}
                          <div className="text-sm text-[#103D5E]/60">
                            {transfer.targetDomain.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#103D5E]">
                          {transfer.sourceIntervention.modality}
                          <div className="text-sm text-[#103D5E]/60">
                            ID: {transfer.sourceIntervention.id}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#103D5E]">
                          {parseFloat(transfer.amount).toFixed(2)} tCO2e
                        </td>
                        <td className="px-4 py-3">
                          <TransferStatusBadge status={transfer.status} />
                        </td>
                        <td className="px-4 py-3">
                          <TransferActions
                            transfer={transfer}
                            onApprove={() => handleApproveTransfer(transfer.id)}
                            onReject={() => handleRejectTransfer(transfer.id)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {filteredTransfers.length === 0 && (
                  <div className="text-center py-8 text-[#103D5E]/60">
                    No transfers found
                  </div>
                )}
              </div>
            </div>
            
            {/* Transfer Form Modal */}
            {isTransferFormOpen && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white/95 backdrop-blur-md rounded-xl p-6 w-full max-w-lg">
                <h2 className="text-xl font-semibold text-[#103D5E] mb-4">New Transfer</h2>
                  {error && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                      {error}
                    </div>
                  )}
                  <form onSubmit={handleTransfer}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[#103D5E]/70 mb-1">
                          Intervention
                        </label>
                        <select
                          required
                          value={formData.interventionId}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            interventionId: e.target.value
                          }))}
                          className="w-full px-3 py-2 bg-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#103D5E]/50"
                        >
                          <option value="">Select intervention</option>
                          {interventionData
                            .filter(intervention => intervention.status === 'verified')
                            .map((intervention) => (
                              <option key={intervention.interventionId} value={intervention.interventionId}>
                                {intervention.modality} - {intervention.emissionsAbated} tCO2e
                              </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-[#103D5E]/70 mb-1">
                          Trading Partner
                        </label>
                        {tradingPartners.length > 0 ? (
                          <select
                            required
                            value={formData.targetDomainId}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              targetDomainId: parseInt(e.target.value)
                            }))}
                            className="w-full px-3 py-2 bg-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#103D5E]/50"
                          >
                            <option value="">Select trading partner</option>
                            {tradingPartners.map((partner) => (
                              <option key={partner.id} value={partner.id}>
                                {partner.companyName}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="text-sm text-[#103D5E]/70 p-4 bg-white/20 rounded-lg">
                            <p className="mb-2">No trading partners available.</p>
                            <button
                              type="button"
                              onClick={handlePartnershipSetup}
                              className="text-[#103D5E] hover:underline font-medium"
                            >
                              Set up trading partnerships
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-[#103D5E]/70 mb-1">
                          Amount (tCO2e)
                        </label>
                        <input
                          type="number"
                          required
                          step="0.01"
                          min="0.01"
                          value={formData.amount}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            amount: e.target.value
                          }))}
                          className="w-full px-3 py-2 bg-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#103D5E]/50"
                        />
                        {formData.interventionId && (
                          <p className="text-sm text-[#103D5E]/60 mt-1">
                            Available: {
                              interventionData.find(i => i.interventionId === formData.interventionId)?.emissionsAbated || 0
                            } tCO2e
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-[#103D5E]/70 mb-1">
                          Notes (Optional)
                        </label>
                        <textarea
                          value={formData.notes}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            notes: e.target.value
                          }))}
                          className="w-full px-3 py-2 bg-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#103D5E]/50 h-24 resize-none"
                          placeholder="Add any additional information about this transfer"
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-4 mt-6">
                      <button
                        type="button"
                        onClick={() => setIsTransferFormOpen(false)}
                        className="px-4 py-2 text-[#103D5E] hover:bg-white/20 rounded-lg transition-all duration-300"
                        disabled={loading}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex items-center gap-2 px-4 py-2 bg-[#103D5E] text-white rounded-lg hover:bg-[#103D5E]/90 transition-all duration-300 disabled:opacity-50"
                        disabled={loading || !tradingPartners.length}
                      >
                        {loading ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <ArrowLeftRight className="h-4 w-4" />
                            Create Transfer
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            
            {/* Transfer Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard 
                title="Total Transferred Out"
                value={transfers
                  .filter(t => 
                    t.status === 'completed' && 
                    t.sourceDomain.name === user?.domain?.name
                  )
                  .reduce((sum, t) => sum + parseFloat(t.amount), 0)
                  .toFixed(1)}
                unit="tCO2e"
                icon={<ArrowLeftRight className="h-6 w-6 text-[#103D5E]" />}
              />
              <MetricCard 
                title="Total Received"
                value={transfers
                  .filter(t => 
                    t.status === 'completed' && 
                    t.targetDomain.name === user?.domain?.name
                  )
                  .reduce((sum, t) => sum + parseFloat(t.amount), 0)
                  .toFixed(1)}
                unit="tCO2e"
                icon={<Building className="h-6 w-6 text-[#103D5E]" />}
              />
              <MetricCard 
                title="Pending Transfers"
                value={transfers.filter(t => 
                  t.status === 'pending' &&
                  (t.sourceDomain.name === user?.domain?.name ||
                   t.targetDomain.name === user?.domain?.name)
                ).length}
                unit="transfers"
                icon={<Clock className="h-6 w-6 text-[#103D5E]" />}
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

export default CarbonTransfer;