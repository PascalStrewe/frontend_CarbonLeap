// C:/Users/PascalStrewe/Downloads/frontend_CarbonLeap/src/components/carbon-dashboard.tsx

import React from 'react';
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useInterventions } from '../context/InterventionContext';
import Sidebar from './Sidebar';


interface Intervention {
  date: string;
  emissionsAbated: number;
  clientName?: string;
  interventionId: string;
  modality: string;
  geography: string;
  status?: string;
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
  const { interventionData } = useInterventions();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.isAdmin;

  // Filter data for the current user unless admin
  const filteredInterventionData = isAdmin 
    ? interventionData 
    : interventionData.filter((intervention: Intervention) => 
        intervention.clientName === user?.name
      );

  console.log('Filtered Intervention Data:', filteredInterventionData);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Calculate total stats from intervention data
  const totalEmissions = filteredInterventionData.reduce((sum, intervention) => 
    sum + intervention.emissionsAbated, 0
  );
  const totalInterventions = filteredInterventionData.length;
  const pendingRequests = filteredInterventionData.filter(
    intervention => {
      console.log('Checking intervention status:', intervention.status);
      return intervention.status?.toLowerCase() === 'pending_review';
    }
  ).length;

  const verifiedRequests = filteredInterventionData.filter(
    intervention => intervention.status?.toLowerCase() === 'verified'
  ).length;

  console.log('Pending Requests Count:', pendingRequests);

  // Sort interventions by date for recent activity
  const sortedInterventions = [...filteredInterventionData].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec]">
      {/* Navigation */}
      <nav className="backdrop-blur-sm border-b border-white/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center p-4">
          <div className="flex items-center space-x-2">
            <img 
              src="/images/logo_CarbonLeap.webp"
              alt="CarbonLeap Logo" 
              className="h-20 w-auto"
            />
          </div>
          <div className="flex items-center space-x-4">
            <div className="px-4 py-2 bg-white/10 rounded-lg backdrop-blur-md">
              <span className="text-[#103D5E] font-medium">Welcome, {user?.name}</span>
            </div>
            <button 
              className="text-[#103D5E] hover:bg-white/20 p-2 rounded-lg transition-all duration-300"
              onClick={() => navigate('/settings')}
            >
              <Settings className="h-5 w-5" />
            </button>
            <button 
              className="text-[#103D5E] hover:bg-white/20 p-2 rounded-lg transition-all duration-300"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </nav>

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