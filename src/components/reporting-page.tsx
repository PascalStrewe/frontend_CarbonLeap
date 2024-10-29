import React, { useState, useMemo, useCallback } from 'react';
import { 
  Download, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Calendar,
  Ship, 
  Truck, 
  Plane, 
  Train,
  BarChart as BarChartIcon,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  X
} from 'lucide-react';
import Sidebar from './Sidebar';
import { useInterventions } from '../context/InterventionContext';

interface FilterState {
  dateRange: {
    start: string;
    end: string;
  };
  modality: string;
  geography: string;
  additionality: string;
  causality: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; positive: boolean };
}

const ReportingPage: React.FC = () => {
  const { interventionData } = useInterventions();
  const [filters, setFilters] = useState<FilterState>({
    dateRange: { start: '', end: '' },
    modality: 'all',
    geography: 'all',
    status: 'all',
    additionality: 'all',
    causality: 'all'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [showFilters, setShowFilters] = useState(false);

  const processedData = useMemo(() => {
    // First filter for verified interventions only
    const verifiedOnly = interventionData.filter(item => 
      item.status?.toLowerCase() === 'verified'
    );
  
    // Then apply the rest of the filters
    return verifiedOnly
      .filter(item => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || 
          item.clientName.toLowerCase().includes(searchLower) ||
          item.interventionId.toLowerCase().includes(searchLower) ||
          item.geography.toLowerCase().includes(searchLower);

        const matchesModality = filters.modality === 'all' || item.modality === filters.modality;
        const matchesGeography = filters.geography === 'all' || item.geography === filters.geography;
        const matchesStatus = filters.status === 'all' || 
          (filters.status === 'pending_review' && 
            (item.status?.toLowerCase().includes('pending') || 
            item.status?.toLowerCase() === 'pending_review')) ||
          (filters.status === 'verified' && 
            item.status?.toLowerCase() === 'verified');
        const matchesAdditionality = filters.additionality === 'all' || 
          (filters.additionality === 'yes' ? item.additionality : !item.additionality);
        const matchesCausality = filters.causality === 'all' || 
          (filters.causality === 'yes' ? item.causality : !item.causality);

        const itemDate = new Date(item.date);
        const matchesDateRange = 
          (!filters.dateRange.start || itemDate >= new Date(filters.dateRange.start)) &&
          (!filters.dateRange.end || itemDate <= new Date(filters.dateRange.end));

        return matchesSearch && matchesModality && matchesGeography && 
               matchesStatus && matchesAdditionality && matchesCausality && 
               matchesDateRange;
      })
      .sort((a, b) => {
        const aValue = a[sortConfig.key as keyof typeof a];
        const bValue = b[sortConfig.key as keyof typeof b];
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        
        return sortConfig.direction === 'asc'
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      });
  }, [interventionData, searchTerm, filters, sortConfig]);

  const stats = useMemo(() => ({
    totalEmissions: processedData.reduce((sum, item) => sum + item.emissionsAbated, 0),
    totalInterventions: processedData.length,
  }), [processedData]);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleExport = () => {
    const headers = [
      'Intervention ID', 'Date', 'Client', 'Emissions Abated', 
      'Modality', 'Geography', 'Status', 'Additionality', 'Causality'
    ];
    const csvContent = [
      headers.join(','),
      ...processedData.map(row => [
        row.interventionId,
        row.date,
        row.clientName,
        row.emissionsAbated,
        row.modality,
        row.geography,
        row.status,
        row.additionality ? 'Yes' : 'No',
        row.causality ? 'Yes' : 'No'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `intervention_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend }) => (
    <div className="bg-white/25 backdrop-blur-md rounded-lg p-6 border border-white/20">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-medium text-[#103D5E]/70">{title}</h3>
          <p className="mt-2 text-3xl font-bold text-[#103D5E]">{value}</p>
          {trend && (
            <p className={`mt-2 text-sm flex items-center gap-1 ${
              trend.positive ? 'text-green-600' : 'text-red-600'
            }`}>
              {trend.positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {trend.value}%
            </p>
          )}
        </div>
        <div className="p-3 bg-white/30 rounded-lg">
          {icon}
        </div>
      </div>
    </div>
  );

  const FilterPanel = () => (
    <div className={`bg-white/25 backdrop-blur-md rounded-lg p-6 border border-white/20 ${
      showFilters ? 'block' : 'hidden'
    }`}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Date Range Filter */}
        <div>
          <label className="block text-sm font-medium text-[#103D5E] mb-2">Date Range</label>
          <div className="space-y-2">
            <input
              type="date"
              value={filters.dateRange.start}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                dateRange: { ...prev.dateRange, start: e.target.value }
              }))}
              className="w-full px-3 py-2 bg-white/50 border border-white/20 rounded-lg"
            />
            <input
              type="date"
              value={filters.dateRange.end}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                dateRange: { ...prev.dateRange, end: e.target.value }
              }))}
              className="w-full px-3 py-2 bg-white/50 border border-white/20 rounded-lg"
            />
          </div>
        </div>

        {/* Geography Filter */}
        <div>
          <label className="block text-sm font-medium text-[#103D5E] mb-2">Geography</label>
          <select
            value={filters.geography}
            onChange={(e) => setFilters(prev => ({ ...prev, geography: e.target.value }))}
            className="w-full px-3 py-2 bg-white/50 border border-white/20 rounded-lg"
          >
            <option value="all">All Geographies</option>
            {Array.from(new Set(interventionData.map(item => item.geography))).map(geo => (
              <option key={geo} value={geo}>{geo}</option>
            ))}
          </select>
        </div>

        {/* Additionality Filter */}
        <div>
          <label className="block text-sm font-medium text-[#103D5E] mb-2">Additionality</label>
          <select
            value={filters.additionality}
            onChange={(e) => setFilters(prev => ({ ...prev, additionality: e.target.value }))}
            className="w-full px-3 py-2 bg-white/50 border border-white/20 rounded-lg"
          >
            <option value="all">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        {/* Causality Filter */}
        <div>
          <label className="block text-sm font-medium text-[#103D5E] mb-2">Causality</label>
          <select
            value={filters.causality}
            onChange={(e) => setFilters(prev => ({ ...prev, causality: e.target.value }))}
            className="w-full px-3 py-2 bg-white/50 border border-white/20 rounded-lg"
          >
            <option value="all">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        {/* Reset Filters Button */}
        <div className="flex items-end">
          <button
            onClick={() => setFilters({
              dateRange: { start: '', end: '' },
              modality: 'all',
              geography: 'all',
              additionality: 'all',
              causality: 'all'
            })}
            className="px-4 py-2 bg-[#103D5E] text-white rounded-lg hover:bg-[#103D5E]/90 transition-all"
          >
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec]">
      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-[#103D5E]">Intervention Reports</h1>
                <p className="text-[#103D5E]/70 mt-1">
                  Analyzing {processedData.length} interventions
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/25 backdrop-blur-md rounded-lg 
                    border border-white/20 text-[#103D5E] hover:bg-white/30 transition-all"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 bg-[#103D5E] text-white rounded-lg 
                    hover:bg-[#103D5E]/90 transition-all"
                >
                  <Download className="h-4 w-4" />
                  Export Data
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                title="Total Emissions Abated"
                value={`${stats.totalEmissions.toFixed(1)} tCO2e`}
                icon={<BarChartIcon className="h-6 w-6 text-[#103D5E]" />}
                trend={{ value: 12.5, positive: true }}
              />
              <StatCard
                title="Total Interventions"
                value={stats.totalInterventions}
                icon={<BarChartIcon className="h-6 w-6 text-[#103D5E]" />}
                trend={{ value: 8.3, positive: true }}
              />
              <StatCard
                title="Average Reduction"
                value={`${(stats.totalEmissions / stats.totalInterventions).toFixed(1)} tCO2e`}
                icon={<BarChartIcon className="h-6 w-6 text-[#103D5E]" />}
              />
            </div>

            {/* Filter Panel */}
            <FilterPanel />

            {/* Filters Bar */}
            <div className="flex flex-wrap gap-4 items-center bg-white/25 backdrop-blur-md rounded-lg p-4 border border-white/20">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#103D5E]/40" />
                  <input
                    type="text"
                    placeholder="Search interventions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/50 border border-white/20 rounded-lg 
                      focus:outline-none focus:ring-1 focus:ring-[#103D5E] text-[#103D5E]"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                {[
                  { value: 'all', label: 'All', icon: Filter },
                  { value: 'Marine', label: 'Marine', icon: Ship },
                  { value: 'Road', label: 'Road', icon: Truck },
                  { value: 'Air', label: 'Air', icon: Plane },
                  { value: 'Rail', label: 'Rail', icon: Train }
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setFilters(prev => ({ ...prev, modality: value }))}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                      filters.modality === value
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

            {/* Active Filters Display */}
            {(filters.dateRange.start || filters.dateRange.end || 
              filters.geography !== 'all' || 
              filters.additionality !== 'all' || 
              filters.causality !== 'all') && (
              <div className="flex flex-wrap gap-2 bg-white/25 backdrop-blur-md rounded-lg p-4 border border-white/20">
                {filters.dateRange.start && (
                  <div className="flex items-center gap-2 bg-white/50 px-3 py-1 rounded-full text-sm text-[#103D5E]">
                    <span>From: {new Date(filters.dateRange.start).toLocaleDateString()}</span>
                    <button
                      onClick={() => setFilters(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, start: '' }
                      }))}
                      className="hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {filters.dateRange.end && (
                  <div className="flex items-center gap-2 bg-white/50 px-3 py-1 rounded-full text-sm text-[#103D5E]">
                    <span>To: {new Date(filters.dateRange.end).toLocaleDateString()}</span>
                    <button
                      onClick={() => setFilters(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, end: '' }
                      }))}
                      className="hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {filters.geography !== 'all' && (
                  <div className="flex items-center gap-2 bg-white/50 px-3 py-1 rounded-full text-sm text-[#103D5E]">
                    <span>Geography: {filters.geography}</span>
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, geography: 'all' }))}
                      className="hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {filters.additionality !== 'all' && (
                  <div className="flex items-center gap-2 bg-white/50 px-3 py-1 rounded-full text-sm text-[#103D5E]">
                    <span>Additionality: {filters.additionality}</span>
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, additionality: 'all' }))}
                      className="hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {filters.causality !== 'all' && (
                  <div className="flex items-center gap-2 bg-white/50 px-3 py-1 rounded-full text-sm text-[#103D5E]">
                    <span>Causality: {filters.causality}</span>
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, causality: 'all' }))}
                      className="hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Data Table */}
            <div className="bg-white/25 backdrop-blur-md rounded-lg shadow-lg border border-white/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/20 table-fixed w-[2000px]"> {/* Increased width */}
                  <thead>
                    <tr className="bg-white/10">
                      {[
                        { key: 'interventionId', label: 'ID', width: 'w-40' },
                        { key: 'date', label: 'Date', width: 'w-32' },
                        { key: 'emissionsAbated', label: 'Emissions Abated', width: 'w-44' },
                        { key: 'modality', label: 'Modality', width: 'w-32' },
                        { key: 'geography', label: 'Geography', width: 'w-44' },
                        { key: 'vendorName', label: 'Vendor', width: 'w-40' },
                        { key: 'quantity', label: 'Quantity', width: 'w-32' },
                        { key: 'unit', label: 'Unit', width: 'w-24' },
                        { key: 'amount', label: 'Amount [L]', width: 'w-32' },
                        { key: 'interventionType', label: 'Intervention Type', width: 'w-44' },
                        { key: 'biofuelProduct', label: 'Biofuel Product', width: 'w-44' },
                        { key: 'baselineFuelProduct', label: 'Baseline Fuel', width: 'w-44' },
                        { key: 'typeOfVehicle', label: 'Vehicle Type', width: 'w-44' },
                        { key: 'year', label: 'Year', width: 'w-24' },
                        { key: 'typeOfFeedstock', label: 'Feedstock Type', width: 'w-44' },
                        { key: 'emissionReductionPercentage', label: 'Emission Reduction %', width: 'w-44' },
                        { key: 'intensityOfBaseline', label: 'Baseline Intensity', width: 'w-44' },
                        { key: 'intensityLowCarbonFuel', label: 'Low-Carbon Intensity', width: 'w-44' },
                        { key: 'certification', label: 'Certification', width: 'w-40' },
                        { key: 'scope', label: 'Scope', width: 'w-32' },
                        { key: 'thirdPartyVerifier', label: 'Third Party Verifier', width: 'w-44' },
                        { key: 'additionality', label: 'Additionality', width: 'w-32' },
                        { key: 'causality', label: 'Causality', width: 'w-32' },
                        { key: 'standards', label: 'Standards', width: 'w-44' },
                        { key: 'status', label: 'Status', width: 'w-32' }
                      ].map(({ key, label, width }) => (
                        <th
                          key={key}
                          onClick={() => handleSort(key)}
                          className={`sticky top-0 ${width} px-6 py-3 text-left text-xs font-medium text-[#103D5E] uppercase tracking-wider cursor-pointer hover:bg-white/20`}
                        >
                          <div className="flex items-center space-x-1">
                            <span>{label}</span>
                            <div className="flex flex-col">
                              <ChevronUp className={`h-3 w-3 ${
                                sortConfig.key === key && sortConfig.direction === 'asc' ? 'text-[#103D5E]' : 'text-[#103D5E]/30'
                              }`} />
                              <ChevronDown className={`h-3 w-3 ${
                                sortConfig.key === key && sortConfig.direction === 'desc' ? 'text-[#103D5E]' : 'text-[#103D5E]/30'
                              }`} />
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white/10 divide-y divide-white/20">
                    {processedData.map((row) => (
                      <tr key={row.interventionId} className="hover:bg-white/20">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.interventionId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {new Date(row.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.emissionsAbated.toFixed(1)} tCO2e
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.modality}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.geography}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.vendorName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.amount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.interventionType}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.biofuelProduct}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.baselineFuelProduct || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.typeOfVehicle}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.year}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.typeOfFeedstock}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.emissionReductionPercentage}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.intensityOfBaseline || 'n/a'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.intensityLowCarbonFuel || 'n/a'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.certification}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.scope}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.thirdPartyVerifier}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            row.additionality 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {row.additionality ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            row.causality 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {row.causality ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[#103D5E]">
                          {row.standards}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            row.status?.toLowerCase() === 'verified'
                              ? 'bg-green-100 text-green-800'
                              : row.status?.toLowerCase().includes('pending') || row.status?.toLowerCase() === 'pending_review'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
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
            {processedData.length === 0 && (
              <div className="text-center py-8 text-[#103D5E]/70">
                No matching interventions found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportingPage;