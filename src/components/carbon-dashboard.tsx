import React, { useState } from 'react';
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
  ChevronLeft,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useInterventions } from '../context/InterventionContext';

const Dashboard = () => {
  const { interventionData } = useInterventions();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.isAdmin;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Filter data for the current user unless admin
  const filteredInterventionData = isAdmin 
    ? interventionData 
    : interventionData.filter(intervention => intervention.clientName === user?.name);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navigateTo = (path) => {
    navigate(path);
  };

  // Calculate total stats from intervention data
  const totalEmissions = filteredInterventionData.reduce((sum, intervention) => 
    sum + intervention.emissionsAbated, 0
  );
  const totalInterventions = filteredInterventionData.length;
  const pendingRequests = filteredInterventionData.filter(
    intervention => intervention.status === 'Pending'
  ).length;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec]">
      {/* Navigation */}
      <nav className="backdrop-blur-sm border-b border-white/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center p-4">
          <div className="flex items-center space-x-2">
            <img 
              src="/images/logo.webp"
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
              onClick={() => navigateTo('/settings')}
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
        {/* Sidebar */}
        <div className={`${sidebarCollapsed ? 'w-20' : 'w-64'} transition-all duration-300 relative`}>
          <div className="fixed h-full bg-white/25 backdrop-blur-md border-r border-white/20">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="absolute -right-3 top-8 bg-white/25 backdrop-blur-md rounded-full p-1 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <ChevronLeft className={`h-4 w-4 text-[#103D5E] transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            </button>
            <div className="p-4 space-y-2">
              <SidebarItem 
                icon={<Home />} 
                text="Dashboard" 
                active={true}
                onClick={() => navigateTo('/dashboard')}
                collapsed={sidebarCollapsed}
              />
              <SidebarItem 
                icon={<BarChart3 />} 
                text="Analytics" 
                onClick={() => navigateTo('/analytics')}
                collapsed={sidebarCollapsed}
              />
              <SidebarItem 
                icon={<FileSpreadsheet />} 
                text="Reports" 
                onClick={() => navigateTo('/reports')}
                collapsed={sidebarCollapsed}
              />
              <SidebarItem 
                icon={<Plus />} 
                text="New Request" 
                onClick={() => navigateTo('/request')}
                collapsed={sidebarCollapsed}
              />
              <SidebarItem 
                icon={<Clock />} 
                text="Pending" 
                onClick={() => navigateTo('/pending')}
                collapsed={sidebarCollapsed}
              />
              {isAdmin && (
                <div className="pt-4 mt-4 border-t border-white/20">
                  <SidebarItem 
                    icon={<FileSpreadsheet />} 
                    text="Upload Data" 
                    onClick={() => navigateTo('/admin/upload')}
                    collapsed={sidebarCollapsed}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
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
                value={totalInterventions - pendingRequests}
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
                {filteredInterventionData.slice(-3).map((intervention, index) => (
                  <ActivityItem 
                    key={intervention.interventionId}
                    title={`${intervention.modality} Intervention ${intervention.interventionId}`}
                    description={`${intervention.emissionsAbated.toFixed(1)} tCO2e reduced in ${intervention.geography}`}
                    time={new Date(intervention.date).toLocaleDateString()}
                    status={intervention.status?.toLowerCase() || 'success'}
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

const DashboardChart = ({ interventionData }) => {
  // Process data for the chart
  const monthlyData = interventionData.reduce((acc, intervention) => {
    // Handle date in MM/DD/YYYY format
    const [month, day, year] = intervention.date.split('/');
    const date = new Date(year, month - 1, day); // month is 0-based in JS
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
  }, {});

  // Convert to array and calculate cumulative values
  const chartData = Object.values(monthlyData)
    .sort((a, b) => new Date(a.month) - new Date(b.month))
    .reduce((acc, curr) => {
      const prevCumulative = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
      curr.cumulative = prevCumulative + curr.value;
      acc.push(curr);
      return acc;
    }, []);

  const CustomTooltip = ({ active, payload, label }) => {
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

const SidebarItem = ({ icon, text, active = false, onClick, collapsed }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center ${collapsed ? 'justify-center' : 'space-x-3'} p-3 rounded-lg transition-all duration-300 ${
      active 
        ? 'bg-[#103D5E] text-white shadow-md' 
        : 'text-[#103D5E] hover:bg-white/30'
    }`}
  >
    {icon}
    {!collapsed && <span className="font-medium">{text}</span>}
  </button>
);

const MetricCard = ({ icon, title, value, unit, trend, positive }) => (
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

const ActivityItem = ({ title, description, time, status }) => {
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