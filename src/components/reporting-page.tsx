import React, { useState } from 'react';
import { Download, Filter, ChevronDown, ChevronUp, Search, Calendar, Ship, Truck, Plane } from 'lucide-react';

const ReportingPage = () => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModality, setSelectedModality] = useState('all');
  
  // Enhanced sample data
  const [data] = useState([
    {
      id: 1,
      projectName: 'Maritime Fuel Switch #M-2024-089',
      date: '2024-03-15',
      emissionReduction: 1250,
      modality: 'Maritime',
      geography: 'Netherlands',
      status: 'Verified'
    },
    {
      id: 2,
      projectName: 'Rail Transport Initiative #R-2024-045',
      date: '2024-03-10',
      emissionReduction: 850,
      modality: 'Rail',
      geography: 'Germany',
      status: 'Pending'
    },
    {
      id: 3,
      projectName: 'Air Freight Optimization #A-2024-023',
      date: '2024-03-08',
      emissionReduction: 2100,
      modality: 'Air',
      geography: 'France',
      status: 'Verified'
    },
    {
      id: 4,
      projectName: 'Truck Fleet Upgrade #T-2024-067',
      date: '2024-03-05',
      emissionReduction: 1500,
      modality: 'Road',
      geography: 'Belgium',
      status: 'Verified'
    },
  ]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredData = data.filter(item => {
    const matchesSearch = item.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.geography.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesModality = selectedModality === 'all' || item.modality === selectedModality;
    return matchesSearch && matchesModality;
  });
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-[#103D5E]">Intervention Reports</h1>
          
          <button
            onClick={() => console.log('Exporting...')}
            className="flex items-center space-x-2 bg-[#103D5E] text-white px-4 py-2 rounded-lg hover:bg-[#103D5E]/90 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export to Excel</span>
          </button>
        </div>

        {/* Filters Section */}
        <div className="bg-white/25 backdrop-blur-md rounded-lg p-4 mb-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] border border-white/20">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#103D5E]/40" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#103D5E] text-[#103D5E]"
                />
              </div>
            </div>

            {/* Modality Filter */}
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'All', icon: Filter },
                { value: 'Maritime', label: 'Maritime', icon: Ship },
                { value: 'Road', label: 'Road', icon: Truck },
                { value: 'Air', label: 'Air', icon: Plane },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setSelectedModality(value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                    selectedModality === value
                      ? 'bg-[#103D5E] text-white'
                      : 'bg-white/50 text-[#103D5E] hover:bg-white/70'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Table Section */}
        <div className="bg-white/25 backdrop-blur-md rounded-lg shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/20">
              <thead>
                <tr className="bg-white/10">
                  {['Project Name', 'Date', 'Emission Reduction', 'Modality', 'Geography', 'Status'].map((header) => (
                    <th
                      key={header}
                      className="px-6 py-3 text-left text-xs font-medium text-[#103D5E] uppercase tracking-wider cursor-pointer hover:bg-white/20 transition-colors duration-200"
                      onClick={() => handleSort(header.toLowerCase())}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{header}</span>
                        <div className="flex flex-col">
                          <ChevronUp className="h-3 w-3" />
                          <ChevronDown className="h-3 w-3" />
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="backdrop-blur-md divide-y divide-white/20">
                {filteredData.map((row) => (
                  <tr key={row.id} className="hover:bg-white/10 transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#103D5E]">
                      {row.projectName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]/70">
                      {new Date(row.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]/70">
                      {row.emissionReduction.toLocaleString()} tCO2e
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]/70">
                      {row.modality}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]/70">
                      {row.geography}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        row.status === 'Verified' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Empty State */}
        {filteredData.length === 0 && (
          <div className="text-center py-8 text-[#103D5E]/70">
            No matching reports found
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportingPage;