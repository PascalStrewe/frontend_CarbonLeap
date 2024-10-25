import React, { useState } from 'react';
import { BarChart3, Filter, Search, Calendar, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const AnalyticsPage = ({ interventionData = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModality, setSelectedModality] = useState('all');
  const [selectedView, setSelectedView] = useState('monthly'); // 'monthly' or 'cumulative'

  // Group and aggregate data by month
  const monthlyData = interventionData.reduce((acc, intervention) => {
    const date = new Date(intervention.date);
    const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!acc[monthYear]) {
      acc[monthYear] = {
        month: monthYear,
        emissions: 0,
        interventions: 0,
        modalityBreakdown: {}
      };
    }
    
    acc[monthYear].emissions += intervention.emissionsAbated;
    acc[monthYear].interventions += 1;
    
    if (!acc[monthYear].modalityBreakdown[intervention.modality]) {
      acc[monthYear].modalityBreakdown[intervention.modality] = 0;
    }
    acc[monthYear].modalityBreakdown[intervention.modality] += intervention.emissionsAbated;
    
    return acc;
  }, {});

  // Convert to array and sort by date
  const monthlyChartData = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

  // Calculate cumulative data
  const cumulativeData = monthlyChartData.reduce((acc, month, index) => {
    const prevTotal = index > 0 ? acc[index - 1].totalEmissions : 0;
    acc.push({
      month: month.month,
      totalEmissions: prevTotal + month.emissions
    });
    return acc;
  }, []);

  // Calculate total stats
  const totalStats = interventionData.reduce((acc, intervention) => ({
    totalEmissions: acc.totalEmissions + intervention.emissionsAbated,
    totalInterventions: acc.totalInterventions + 1,
    averagePerIntervention: (acc.totalEmissions + intervention.emissionsAbated) / (acc.totalInterventions + 1)
  }), { totalEmissions: 0, totalInterventions: 0, averagePerIntervention: 0 });

  // Filter interventions based on search and modality
  const filteredInterventions = interventionData.filter(intervention => {
    const matchesSearch = intervention.interventionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         intervention.geography.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesModality = selectedModality === 'all' || intervention.modality === selectedModality;
    return matchesSearch && matchesModality;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header and Stats */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#103D5E] mb-6">Intervention Analytics</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatsCard
              title="Total Emissions Abated"
              value={`${totalStats.totalEmissions.toFixed(1)} tCO2e`}
              trend="+12.3%"
              positive={true}
            />
            <StatsCard
              title="Total Interventions"
              value={totalStats.totalInterventions}
              trend="Active"
            />
            <StatsCard
              title="Average per Intervention"
              value={`${totalStats.averagePerIntervention.toFixed(1)} tCO2e`}
              trend="+5.2%"
              positive={true}
            />
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Emissions Over Time */}
          <div className="bg-white/25 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-[#103D5E]">Emissions Abated Over Time</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedView('monthly')}
                  className={`px-3 py-1 rounded-lg text-sm ${
                    selectedView === 'monthly'
                      ? 'bg-[#103D5E] text-white'
                      : 'bg-white/30 text-[#103D5E]'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setSelectedView('cumulative')}
                  className={`px-3 py-1 rounded-lg text-sm ${
                    selectedView === 'cumulative'
                      ? 'bg-[#103D5E] text-white'
                      : 'bg-white/30 text-[#103D5E]'
                  }`}
                >
                  Cumulative
                </button>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {selectedView === 'monthly' ? (
                  <BarChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#103D5E20" />
                    <XAxis dataKey="month" stroke="#103D5E" />
                    <YAxis stroke="#103D5E" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Bar dataKey="emissions" fill="#103D5E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={cumulativeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#103D5E20" />
                    <XAxis dataKey="month" stroke="#103D5E" />
                    <YAxis stroke="#103D5E" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Line type="monotone" dataKey="totalEmissions" stroke="#103D5E" strokeWidth={2} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Modality Breakdown */}
          <div className="bg-white/25 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]">
            <h2 className="text-lg font-semibold text-[#103D5E] mb-4">Emissions by Modality</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={Object.entries(
                    filteredInterventions.reduce((acc, intervention) => {
                      if (!acc[intervention.modality]) acc[intervention.modality] = 0;
                      acc[intervention.modality] += intervention.emissionsAbated;
                      return acc;
                    }, {})
                  ).map(([modality, value]) => ({ modality, value }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#103D5E20" />
                  <XAxis dataKey="modality" stroke="#103D5E" />
                  <YAxis stroke="#103D5E" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      border: 'none',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar dataKey="value" fill="#B9D9DF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Detailed Intervention List */}
        <div className="bg-white/25 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]">
          <div className="flex flex-wrap gap-4 items-center mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#103D5E]/40" />
                <input
                  type="text"
                  placeholder="Search interventions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#103D5E] text-[#103D5E]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {['all', 'Maritime', 'Road', 'Air', 'Rail'].map((modality) => (
                <button
                  key={modality}
                  onClick={() => setSelectedModality(modality)}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    selectedModality === modality
                      ? 'bg-[#103D5E] text-white'
                      : 'bg-white/50 text-[#103D5E] hover:bg-white/70'
                  }`}
                >
                  {modality}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[#103D5E]">ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[#103D5E]">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[#103D5E]">Modality</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[#103D5E]">Geography</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[#103D5E]">Emissions</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[#103D5E]">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredInterventions.map((intervention, index) => (
                  <tr
                    key={intervention.interventionId}
                    className="border-b border-white/10 hover:bg-white/10"
                  >
                    <td className="px-4 py-3 text-sm text-[#103D5E]">{intervention.interventionId}</td>
                    <td className="px-4 py-3 text-sm text-[#103D5E]">{intervention.date}</td>
                    <td className="px-4 py-3 text-sm text-[#103D5E]">{intervention.modality}</td>
                    <td className="px-4 py-3 text-sm text-[#103D5E]">{intervention.geography}</td>
                    <td className="px-4 py-3 text-sm text-[#103D5E]">
                      {intervention.emissionsAbated.toFixed(1)} tCO2e
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Verified
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatsCard = ({ title, value, trend, positive }) => (
  <div className="bg-white/25 backdrop-blur-md rounded-xl p-6 border border-white/20">
    <h3 className="text-sm font-medium text-[#103D5E]/60">{title}</h3>
    <div className="mt-2 flex items-baseline gap-2">
      <span className="text-2xl font-bold text-[#103D5E]">{value}</span>
      {trend && (
        <span className={`flex items-center text-sm ${
          positive ? 'text-green-500' : trend === 'Active' ? 'text-amber-500' : 'text-[#103D5E]/60'
        }`}>
          {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          {trend}
        </span>
      )}
    </div>
  </div>
);

export default AnalyticsPage;
