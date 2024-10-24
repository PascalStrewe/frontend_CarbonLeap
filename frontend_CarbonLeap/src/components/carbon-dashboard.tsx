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
  ChevronLeft
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';
import logo from 'C:/Users/Pascal Strewe/Downloads/carbonleap_logo.webp';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.isAdmin;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navigateTo = (path) => {
    navigate(path);
  };

  // Sample emission data
  const emissionData = [
    { month: 'Jan', value: 1200 },
    { month: 'Feb', value: 900 },
    { month: 'Mar', value: 1500 },
    { month: 'Apr', value: 800 },
    { month: 'May', value: 1800 },
    { month: 'Jun', value: 950 },
    { month: 'Jul', value: 2000 },
    { month: 'Aug', value: 1700 }
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/25 backdrop-blur-md p-4 rounded-lg shadow-lg border border-white/20">
          <p className="text-[#103D5E] font-medium">{label}</p>
          <p className="text-lg font-bold" style={{ color: payload[0].value >= 1000 ? '#B9D9DF' : '#FF0000' }}>
            {payload[0].value} tCO2e
          </p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec]">
      {/* Navigation - now transparent with white border */}
      <nav className="backdrop-blur-sm border-b border-white/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center p-4">
          <div className="flex items-center space-x-2">
            <img 
              src={logo}
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
                value="2,450"
                unit="tCO2e"
                trend="+12.3%"
                positive={true}
              />
              <MetricCard 
                icon={<Clock className="h-6 w-6 text-[#103D5E]" />}
                title="Pending Requests" 
                value="3"
                unit="projects"
                trend="Active"
              />
              <MetricCard 
                icon={<TrendingUp className="h-6 w-6 text-[#103D5E]" />}
                title="Verified Projects" 
                value="8"
                unit="total"
                trend="+2 this month"
                positive={true}
              />
            </div>

            {/* Chart Area */}
            <div className="bg-white/25 backdrop-blur-md rounded-xl p-6 mb-8 border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] hover:shadow-xl transition-all duration-300">
              <h2 className="text-xl font-semibold text-[#103D5E] mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Emission Reduction Overview
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={emissionData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#B9D9DF" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#B9D9DF" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#103D5E/20" />
                    <XAxis dataKey="month" stroke="#103D5E" />
                    <YAxis stroke="#103D5E" />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#103D5E"
                      strokeWidth={3}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={6}
                            fill={payload.value >= 1000 ? "#B9D9DF" : "#FF0000"}
                            stroke="white"
                            strokeWidth={3}
                          />
                        );
                      }}
                      activeDot={{ r: 8, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white/25 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]">
              <h2 className="text-xl font-semibold text-[#103D5E] mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </h2>
              <div className="space-y-4">
                <ActivityItem 
                  title="New Project Verified"
                  description="Maritime fuel switch project #M-2024-089 has been verified"
                  time="2 hours ago"
                  status="success"
                />
                <ActivityItem 
                  title="Request Submitted"
                  description="New intervention request for rail transport submitted"
                  time="1 day ago"
                  status="pending"
                />
                <ActivityItem 
                  title="Report Generated"
                  description="Q1 2024 emissions reduction report downloaded"
                  time="2 days ago"
                  status="info"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
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
    <div className={`mt-2 text-sm ${
      positive 
        ? 'text-green-600' 
        : trend === 'Active' 
          ? 'text-amber-600' 
          : 'text-[#103D5E]/60'
    }`}>
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