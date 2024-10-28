// C:/Users/PascalStrewe/Downloads/frontend_CarbonLeap/src/components/analytics-page.tsx

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
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  SlidersHorizontal,
  X,
  Check,
  Info,
  Loader2,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  Area,
  AreaChart
} from 'recharts';
import Sidebar from './Sidebar';
import { useInterventions } from '../context/InterventionContext';

interface ChartData {
  name: string;
  value: number;
  percentage?: number;
  color?: string;
}

interface FilterState {
  dateRange: {
    start: string;
    end: string;
  };
  modality: string;
  geography: string;
  interventionType: string;
  certification: string;
  emissionRange: {
    min: number;
    max: number;
  };
  biofuelProduct: string;
  feedstockType: string;
  status: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CHART_COLORS = {
  primary: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'],
  secondary: ['#103D5E', '#B9D9DF', '#FFD700', '#FF6B6B', '#4CAF50'],
  modality: {
    'Marine': '#0088FE',
    'Road': '#00C49F',
    'Rail': '#FFBB28',
    'Air': '#FF8042'
  }
};

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload) return null;

  return (
    <div className="bg-white/90 backdrop-blur-md p-3 rounded-lg shadow-lg border border-white/20">
      <p className="font-medium text-[#103D5E]">{label}</p>
      {payload.map((item, index) => (
        <p key={index} className="text-sm text-[#103D5E]/70">
          {item.name}: {item.value.toFixed(1)} {item.unit || 'tCO2e'}
        </p>
      ))}
    </div>
  );
};

const ReportingPage: React.FC = () => {
  const { interventionData } = useInterventions();
  const [filters, setFilters] = useState<FilterState>({
    dateRange: { start: '', end: '' },
    modality: 'all',
    geography: 'all',
    interventionType: 'all',
    certification: 'all',
    emissionRange: { min: 0, max: Infinity },
    biofuelProduct: 'all',
    feedstockType: 'all',
    status: 'all'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState<'cards' | 'table'>('cards');
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  const processedData = useMemo(() => {
    return interventionData
      .filter(item => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || 
          item.clientName.toLowerCase().includes(searchLower) ||
          item.interventionId.toLowerCase().includes(searchLower) ||
          item.geography.toLowerCase().includes(searchLower);

        const matchesModality = filters.modality === 'all' || item.modality === filters.modality;
        const matchesGeography = filters.geography === 'all' || item.geography === filters.geography;

        const itemDate = new Date(item.date);
        const matchesDateRange = 
          (!filters.dateRange.start || itemDate >= new Date(filters.dateRange.start)) &&
          (!filters.dateRange.end || itemDate <= new Date(filters.dateRange.end));

        return matchesSearch && matchesModality && matchesGeography && matchesDateRange;
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

  const chartData = useMemo(() => {
    const modalityStats = processedData.reduce((acc, item) => {
      if (!acc[item.modality]) {
        acc[item.modality] = {
          name: item.modality,
          value: 0,
          count: 0,
          emissions: 0
        };
      }
      acc[item.modality].count++;
      acc[item.modality].emissions += item.emissionsAbated;
      acc[item.modality].value = acc[item.modality].emissions;
      return acc;
    }, {} as Record<string, any>);

    const timelineData = processedData.reduce((acc, item) => {
      const date = item.date.split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          emissions: 0,
          count: 0
        };
      }
      acc[date].emissions += item.emissionsAbated;
      acc[date].count++;
      return acc;
    }, {} as Record<string, any>);

    return {
      modality: Object.values(modalityStats),
      timeline: Object.values(timelineData)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((item, index, array) => ({
          ...item,
          cumulativeEmissions: array
            .slice(0, index + 1)
            .reduce((sum, curr) => sum + curr.emissions, 0)
        }))
    };
  }, [processedData]);

  const stats = useMemo(() => ({
    totalEmissions: processedData.reduce((sum, item) => sum + item.emissionsAbated, 0),
    totalInterventions: processedData.length,
    averageEmission: processedData.length 
      ? processedData.reduce((sum, item) => sum + item.emissionsAbated, 0) / processedData.length 
      : 0,
    topGeographies: Object.entries(
      processedData.reduce((acc, item) => {
        acc[item.geography] = (acc[item.geography] || 0) + item.emissionsAbated;
        return acc;
      }, {} as Record<string, number>)
    )
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
  }), [processedData]);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleExport = () => {
    const headers = ['Intervention ID', 'Date', 'Client', 'Emissions Abated', 'Modality', 'Geography', 'Status'];
    const csvContent = [
      headers.join(','),
      ...processedData.map(row => [
        row.interventionId,
        row.date,
        row.clientName,
        row.emissionsAbated,
        row.modality,
        row.geography,
        row.status
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

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: { value: number; positive: boolean };
  }> = ({ title, value, icon, trend }) => (
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
                  Filters
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Emissions Abated"
                value={`${stats.totalEmissions.toFixed(1)} tCO2e`}
                icon={<BarChartIcon className="h-6 w-6 text-[#103D5E]" />}
                trend={{ value: 12.5, positive: true }}
              />
              <StatCard
                title="Total Interventions"
                value={stats.totalInterventions}
                icon={<PieChartIcon className="h-6 w-6 text-[#103D5E]" />}
                trend={{ value: 8.3, positive: true }}
              />
              <StatCard
                title="Average Reduction"
                value={`${stats.averageEmission.toFixed(1)} tCO2e`}
                icon={<BarChartIcon className="h-6 w-6 text-[#103D5E]" />}
              />
              <StatCard
                title="Active Modalities"
                value={chartData.modality.length}
                icon={<Ship className="h-6 w-6 text-[#103D5E]" />}
              />
            </div>
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Modality Distribution */}
              <div className="bg-white/25 backdrop-blur-md rounded-lg p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-[#103D5E] mb-4">Distribution by Modality</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.modality}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                      >
                        {chartData.modality.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`}
                            fill={CHART_COLORS.primary[index % CHART_COLORS.primary.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Emissions Timeline */}
              <div className="bg-white/25 backdrop-blur-md rounded-lg p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-[#103D5E] mb-4">Emissions Timeline</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.timeline}>
                      <defs>
                        <linearGradient id="colorEmissions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#103D5E" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#103D5E" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#103D5E20" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fill: '#103D5E' }}
                        tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <YAxis tick={{ fill: '#103D5E' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="emissions"
                        stroke="#103D5E"
                        fillOpacity={1}
                        fill="url(#colorEmissions)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

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

            {/* Data Table */}
            <div className="bg-white/25 backdrop-blur-md rounded-lg shadow-lg border border-white/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/20">
                  <thead>
                    <tr className="bg-white/10">
                      {[
                        { key: 'interventionId', label: 'ID' },
                        { key: 'date', label: 'Date' },
                        { key: 'clientName', label: 'Client' },
                        { key: 'emissionsAbated', label: 'Emissions Abated' },
                        { key: 'modality', label: 'Modality' },
                        { key: 'geography', label: 'Geography' },
                        { key: 'status', label: 'Status' }
                      ].map(({ key, label }) => (
                        <th
                          key={key}
                          onClick={() => handleSort(key)}
                          className="px-6 py-3 text-left text-xs font-medium text-[#103D5E] uppercase tracking-wider cursor-pointer hover:bg-white/20"
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
                          {row.clientName}
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
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