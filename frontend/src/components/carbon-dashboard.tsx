// C:/Users/PascalStrewe/Downloads/frontend_CarbonLeap/src/components/carbon-dashboard.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, 
  FileSpreadsheet, 
  Plus, 
  Clock, 
  LogOut, 
  Settings,
  Home,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useInterventions } from '../context/InterventionContext';
import Sidebar from './Sidebar';
import Navigation from './Navigation';


interface Intervention {
  date: string;
  emissionsAbated: number;
  clientName?: string;
  interventionId: string;
  modality: string;
  geography: string;
  status?: string;
  remainingAmount?: number;
  activeClaims?: number;
  claims?: Array<{
    status: string;
    amount: number;
  }>;
  totalAmount?: number;
}

interface MonthlyData {
  [key: string]: {
    month: string;
    value: number;
    cumulative: number;
  };
}

interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  unit: string;
  trend?: string;
  positive?: boolean;
}

interface ActivityItemProps {
  title: string;
  description: string;
  time: string;
  status: string;
}

const Dashboard: React.FC = () => {
  const { interventionData, refreshInterventions } = useInterventions();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.isAdmin;
  useEffect(() => {
    refreshInterventions();
    const interval = setInterval(refreshInterventions, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [refreshInterventions]);

  // Add this useEffect to fetch data when component mounts
  useEffect(() => {
    refreshInterventions();
  }, [refreshInterventions]);

  // Filter data for the current user unless admin
  const filteredInterventionData = useMemo(() => {
    console.log('Raw intervention data before filtering:', 
      interventionData.map(i => ({
        id: i.interventionId,
        clientName: i.clientName,
        status: i.status,
        remainingAmount: i.remainingAmount,
        activeClaims: i.activeClaims,
        modality: i.modality
      }))
    );
    console.log('Raw intervention data:', interventionData);
    console.log('Current user:', user);
  
    return isAdmin 
      ? interventionData 
      : interventionData.filter((intervention: Intervention) => {
          // First check if the intervention has a valid clientName
          if (!intervention.clientName) return false;
          
          // Handle possible domain in user.name
          const userName = user?.name?.split('@')[0];
          const clientName = intervention.clientName.toLowerCase();
          const searchName = userName?.toLowerCase();
  
          // Debug logging
          console.log('Comparing:', {
            clientName,
            searchName,
            matches: clientName.includes(searchName || '')
          });
  
          return clientName.includes(searchName || '');
        });
  }, [isAdmin, interventionData, user?.name]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Calculate total stats from intervention data
  const totalEmissions = useMemo(() => 
    filteredInterventionData.reduce((sum, intervention) => {
      const isTransferFrom = intervention.modality?.toLowerCase().includes('transfer from');
      const isTransferTo = intervention.modality?.toLowerCase().includes('transfer to') || 
                          (intervention.interventionId?.includes('transfer_') && !isTransferFrom);
  
      // For received transfers
      if (isTransferFrom) {
        return sum + (intervention.emissionsAbated || 0);
      }
  
      // For sent transfers (Transfer Out)
      if (isTransferTo) {
        // Subtract the emissions that were transferred out
        return sum - (intervention.emissionsAbated - (intervention.remainingAmount || 0));
      }
  
      // For regular interventions
      return sum + (intervention.remainingAmount || 0);
    }, 0), [filteredInterventionData]
  );

  const verifiedRequests = useMemo(() => {
    console.log('Starting verified requests calculation...');
    
    const verifiedList = filteredInterventionData.filter(intervention => {
      const isVerified = intervention.status?.toLowerCase() === 'verified' || 
                        intervention.status?.toLowerCase() === 'completed';
      
      // First determine the type of intervention
      const isTransferFrom = intervention.modality?.toLowerCase().includes('transfer from');
      // Check both modality and ID for transfer out since some might not have the modality set correctly
      const isTransferTo = intervention.modality?.toLowerCase().includes('transfer to') || 
                          (intervention.interventionId?.includes('transfer_') && !isTransferFrom);
      
      console.log('Checking intervention:', {
        id: intervention.interventionId,
        isVerified,
        type: isTransferFrom ? 'Transfer In' : isTransferTo ? 'Transfer Out' : 'Regular',
        status: intervention.status,
        remainingAmount: intervention.remainingAmount,
        activeClaims: intervention.activeClaims,
        modality: intervention.modality
      });
  
      // For received transfers (Transfer In)
      if (isTransferFrom) {
        return isVerified;
      }
      
      // For sent transfers (Transfer Out)
      if (isTransferTo) {
        // Don't count transferred out interventions in verified total
        console.log('Transfer Out - Not counting:', intervention.interventionId);
        return false;
      }
  
      // For regular interventions (not transfers)
      const shouldCount = isVerified && 
        (intervention.remainingAmount > 0 || intervention.activeClaims > 0);
      console.log('Regular intervention check:', {
        id: intervention.interventionId,
        result: shouldCount,
        reason: shouldCount ? 
          'Counted because: Verified and has remaining amount or claims' :
          'Not counted because: ' + 
          (!isVerified ? 'Not verified' : 
           'No remaining amount and no active claims')
      });
      return shouldCount;
    });
    
    console.log('Verified requests final calculation:', {
      total: verifiedList.length,
      details: verifiedList.map(v => ({
        id: v.interventionId,
        type: v.modality?.toLowerCase().includes('transfer from') ? 'Transfer In' :
              v.interventionId?.includes('transfer_') ? 'Transfer Out' :
              'Regular',
        status: v.status,
        remainingAmount: v.remainingAmount,
        activeClaims: v.activeClaims
      }))
    });
    
    return verifiedList.length;
  }, [filteredInterventionData]);

const totalInterventions = filteredInterventionData.length;

const pendingRequests = useMemo(() => 
  filteredInterventionData.filter(
    intervention => {
      console.log('Checking intervention status:', intervention.status);
      return intervention.status?.toLowerCase() === 'pending' || 
             intervention.status?.toLowerCase() === 'pending_review';
    }
  ).length, [filteredInterventionData]
);

  console.log('Pending Requests Count:', pendingRequests);

  // Sort interventions by date for recent activity
  const sortedInterventions = [...filteredInterventionData].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec]">
      {/* Navigation */}
      <Navigation />
      {/* Main Content */}
      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <MetricCard 
                icon={<Activity className="h-6 w-6 text-[#103D5E]" />}
                title="Total Emission Reduction" 
                value={totalEmissions.toFixed(1)}
                unit="tCO2e"
                trend={`+${((totalEmissions / 1000) * 100).toFixed(1)}%`}
                positive={true}
              />
              <MetricCard 
                icon={<Clock className="h-6 w-6 text-[#103D5E]" />}
                title="Pending Requests" 
                value={pendingRequests}
                unit="projects"
                trend="Active"
              />
              <MetricCard 
                icon={<TrendingUp className="h-6 w-6 text-[#103D5E]" />}
                title="Verified Projects" 
                value={verifiedRequests}
                unit="total"
                trend={`+${totalInterventions} this month`}
                positive={true}
              />
            </div>

            {/* Chart Area */}
            <DashboardChart interventionData={filteredInterventionData} />

            {/* Recent Activity */}
            <div className="bg-white/25 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]">
              <h2 className="text-xl font-semibold text-[#103D5E] mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </h2>
              <div className="space-y-4">
                {sortedInterventions.slice(0, 3).map((intervention, index) => (
                    <ActivityItem 
                      key={intervention.interventionId}
                      title={`${intervention.modality} Intervention ${intervention.interventionId}`}
                      description={`${intervention.emissionsAbated.toFixed(1)} tCO2e reduced in ${intervention.geography}`}
                      time={intervention.date}
                      status={intervention.status?.toLowerCase() === 'pending' ? 'pending' : 'success'}
                    />
                  ))}
                {filteredInterventionData.length === 0 && (
                  <p className="text-center text-[#103D5E]/70">No recent activity</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardChart = ({ interventionData }: { interventionData: Intervention[] }) => {
  // Process data for the chart
  const monthlyData = interventionData.reduce<MonthlyData>((acc, intervention) => {
    try {
      // Handle date in MM/DD/YYYY format
      const dateParts = intervention.date.split('/');
      if (dateParts.length !== 3) {
        console.warn('Invalid date format:', intervention.date);
        return acc;
      }

      const [month, day, year] = dateParts;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;

      if (!acc[monthYear]) {
        acc[monthYear] = {
          month: monthYear,
          value: 0,
          cumulative: 0
        };
      }
      
      acc[monthYear].value += intervention.emissionsAbated;
      return acc;
    } catch (error) {
      console.warn('Error processing date:', intervention.date, error);
      return acc;
    }
  }, {});

  // Convert to array and calculate cumulative values
  const chartData = Object.values(monthlyData)
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
    .reduce((acc, curr) => {
      const prevCumulative = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
      curr.cumulative = prevCumulative + curr.value;
      acc.push(curr);
      return acc;
    }, [] as Array<{ month: string; value: number; cumulative: number }>);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/25 backdrop-blur-md p-4 rounded-lg shadow-lg border border-white/20">
          <p className="text-[#103D5E] font-medium">{label}</p>
          <div className="space-y-1">
            <p className="text-sm">
              <span className="text-[#103D5E]/70">Monthly: </span>
              <span className="font-bold">{payload[0].value.toFixed(1)} tCO2e</span>
            </p>
            <p className="text-sm">
              <span className="text-[#103D5E]/70">Total: </span>
              <span className="font-bold">{payload[1].value.toFixed(1)} tCO2e</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white/25 backdrop-blur-md rounded-xl p-6 mb-8 border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] hover:shadow-xl transition-all duration-300 relative">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[#103D5E]" />
          <h2 className="text-xl font-semibold text-[#103D5E]">
            Emission Reduction Overview
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 bg-[#B9D9DF] rounded-full"></div>
            <span className="text-[#103D5E]/70">Monthly</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 bg-[#103D5E] rounded-full"></div>
            <span className="text-[#103D5E]/70">Cumulative</span>
          </div>
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="monthlyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#B9D9DF" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#B9D9DF" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#103D5E" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#103D5E" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#103D5E20" />
            <XAxis 
              dataKey="month" 
              stroke="#103D5E" 
              tick={{ fill: '#103D5E' }}
            />
            <YAxis 
              stroke="#103D5E"
              tick={{ fill: '#103D5E' }}
              label={{ 
                value: 'tCO2e', 
                angle: -90, 
                position: 'insideLeft',
                fill: '#103D5E'
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#B9D9DF"
              strokeWidth={2}
              dot={{ r: 4, fill: '#B9D9DF', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="cumulative"
              stroke="#103D5E"
              strokeWidth={2}
              dot={{ r: 4, fill: '#103D5E', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {chartData.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-sm rounded-xl">
          <p className="text-[#103D5E]/70">No data available</p>
        </div>
      )}
    </div>
  );
};

const MetricCard: React.FC<MetricCardProps> = ({ icon, title, value, unit, trend, positive }) => (
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
    <div className={`mt-2 text-sm flex items-center gap-1 ${
      positive 
        ? 'text-green-600' 
        : trend === 'Active' 
          ? 'text-amber-600' 
          : 'text-[#103D5E]/60'
    }`}>
      {trend !== 'Active' && (positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />)}
      {trend}
    </div>
  </div>
);

const ActivityItem: React.FC<ActivityItemProps> = ({ title, description, time, status }) => {
  const statusColors = {
    success: 'border-green-500',
    pending: 'border-amber-500',
    info: 'border-[#103D5E]'
  };

  return (
    <div className={`border-l-4 ${statusColors[status]} bg-white/20 backdrop-blur-sm rounded-r-lg pl-4 py-3 transition-all duration-300 hover:bg-white/30 hover:translate-x-1`}>
      <div className="font-medium text-[#103D5E]">{title}</div>
      <div className="text-sm text-[#103D5E]/60">{description}</div>
      <div className="text-xs text-[#103D5E]/40 mt-1">{time}</div>
    </div>
  );
};

export default Dashboard;