// src/components/partnership-management.tsx

import React, { useState, useEffect } from 'react';
import { 
  Building, 
  UserPlus, 
  Check, 
  X, 
  AlertCircle,
  Search,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import PartnershipRequestModal from './partnership-request-modal';
import Navigation from './Navigation';


interface Partnership {
  id: number;
  domain1: {
    id: number;
    name: string;
    companyName: string;
  };
  domain2: {
    id: number;
    name: string;
    companyName: string;
  };
  status: 'pending' | 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

const PartnershipManagement: React.FC = () => {
  const { user } = useAuth();
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [isRequestFormOpen, setIsRequestFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch partnerships
  useEffect(() => {
    const fetchPartnerships = async () => {
      try {
        const response = await fetch('/api/partnerships', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setPartnerships(data);
        }
      } catch (error) {
        console.error('Error fetching partnerships:', error);
      }
    };
    
    fetchPartnerships();
    const interval = setInterval(fetchPartnerships, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRequestPartnership = async (data: { domainId: number; message: string }) => {
    try {
      const response = await fetch('/api/partnerships', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send partnership request');
      }
      
      const newPartnership = await response.json();
      setPartnerships(prev => [...prev, newPartnership]);
      setIsRequestFormOpen(false);
    } catch (error) {
      throw error;
    }
  };

  const handleUpdatePartnership = async (id: number, status: string) => {
    try {
      const response = await fetch(`/api/partnerships/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status })
      });
      
      if (response.ok) {
        const updatedPartnership = await response.json();
        setPartnerships(prev => 
          prev.map(p => p.id === updatedPartnership.id ? updatedPartnership : p)
        );
      }
    } catch (error) {
      console.error('Error updating partnership:', error);
    }
  };

  // Filter partnerships based on search and status
  const filteredPartnerships = partnerships.filter(partnership => {
    const matchesSearch = 
      partnership.domain1.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partnership.domain2.companyName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || partnership.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

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
                onClick={() => setIsRequestFormOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#103D5E] text-white rounded-lg hover:bg-[#103D5E]/90 transition-all duration-300"
              >
                <UserPlus className="h-5 w-5" />
                New Partnership Request
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
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Partnerships List */}
            <div className="bg-white/25 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] mb-8">
              <h2 className="text-xl font-semibold text-[#103D5E] mb-4 flex items-center gap-2">
                <Building className="h-5 w-5" />
                Trading Partnerships
              </h2>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[#103D5E]/70 text-sm">
                      <th className="px-4 py-2 text-left">Company</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Since</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPartnerships.map((partnership) => {
                    const isPartner1 = partnership.domain1.id === user?.domainId;
                    const partnerCompany = isPartner1 
                      ? partnership.domain2 
                      : partnership.domain1;

                    // Prevent displaying own company if data is incorrect
                    if (partnerCompany.id === user?.domainId) {
                      console.warn(`Partnership ${partnership.id} has the same domain as user.`);
                      return null; // Or handle appropriately
                    }
                      
                      return (
                        <tr 
                          key={partnership.id}
                          className="border-t border-white/10 hover:bg-white/10 transition-colors duration-200"
                        >
                          <td className="px-4 py-3 text-[#103D5E]">
                            {partnerCompany.companyName}
                            <div className="text-sm text-[#103D5E]/60">
                              {partnerCompany.name}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-sm ${
                              partnership.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : partnership.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {partnership.status.charAt(0).toUpperCase() + partnership.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#103D5E]">
                            {new Date(partnership.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {partnership.status === 'pending' && !isPartner1 && (
                                <>
                                  <button
                                    onClick={() => handleUpdatePartnership(partnership.id, 'active')}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                    title="Accept Partnership"
                                  >
                                    <Check className="h-5 w-5" />
                                  </button>
                                  <button
                                    onClick={() => handleUpdatePartnership(partnership.id, 'inactive')}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    title="Reject Partnership"
                                  >
                                    <X className="h-5 w-5" />
                                  </button>
                                </>
                              )}
                              {partnership.status === 'active' && (
                                <button
                                  onClick={() => handleUpdatePartnership(partnership.id, 'inactive')}
                                  className="p-1 text-[#103D5E] hover:bg-white/20 rounded"
                                  title="Deactivate Partnership"
                                >
                                  <AlertCircle className="h-5 w-5" />
                                </button>
                              )}
                              {partnership.status === 'inactive' && (
                                <button
                                  onClick={() => handleUpdatePartnership(partnership.id, 'pending')}
                                  className="p-1 text-[#103D5E] hover:bg-white/20 rounded"
                                  title="Reactivate Partnership"
                                >
                                  <RefreshCw className="h-5 w-5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                {filteredPartnerships.length === 0 && (
                  <div className="text-center py-8 text-[#103D5E]/60">
                    No partnerships found
                  </div>
                )}
              </div>
            </div>

            {/* Partnership Request Modal */}
            {isRequestFormOpen && (
              <PartnershipRequestModal
                onClose={() => setIsRequestFormOpen(false)}
                onSubmit={handleRequestPartnership}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnershipManagement;