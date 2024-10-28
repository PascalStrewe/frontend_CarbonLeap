// C:/Users/PascalStrewe/Downloads/frontend_CarbonLeap/src/components/Sidebar.tsx

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Home,
  BarChart3,
  FileSpreadsheet,
  Plus,
  Clock,
  ChevronLeft,
  Upload,
  Settings,
  LogOut
} from 'lucide-react';

interface NavItemProps {
  icon: React.ReactNode;
  text: string;
  path?: string;
  onClick?: () => void;
}

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navigationItems = [
    {
      icon: <Home className="h-5 w-5" />,
      text: "Dashboard",
      path: "/dashboard"
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      text: "Analytics",
      path: "/analytics"
    },
    {
      icon: <FileSpreadsheet className="h-5 w-5" />,
      text: "Reports",
      path: "/reports"
    },
    {
      icon: <Plus className="h-5 w-5" />,
      text: "New Request",
      path: "/request"
    },
    {
      icon: <Clock className="h-5 w-5" />,
      text: "Pending",
      path: "/pending"
    }
  ];

  const adminItems = [
    {
      icon: <Upload className="h-5 w-5" />,
      text: "Upload Data",
      path: "/admin/upload"
    }
  ];

  const bottomItems = [
    {
      icon: <Settings className="h-5 w-5" />,
      text: "Settings",
      path: "/settings"
    },
    {
      icon: <LogOut className="h-5 w-5" />,
      text: "Logout",
      onClick: handleLogout
    }
  ];

  const NavItem: React.FC<NavItemProps> = ({ icon, text, path, onClick }) => (
    <button
      onClick={() => onClick ? onClick() : navigate(path!)}
      className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-between'} p-3 rounded-lg transition-all duration-300 ${
        path && location.pathname === path
          ? 'bg-[#103D5E] text-white'
          : 'text-[#103D5E] hover:bg-white/30'
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        {!collapsed && <span className="font-medium">{text}</span>}
      </div>
      {!collapsed && path && location.pathname === path && (
        <div className="h-2 w-2 rounded-full bg-white" />
      )}
    </button>
  );

  return (
    <div className={`${collapsed ? 'w-20' : 'w-64'} transition-all duration-300 relative`}>
      <div className="fixed h-full bg-white/25 backdrop-blur-md border-r border-white/20">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-8 bg-white/25 backdrop-blur-md rounded-full p-1 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <ChevronLeft 
            className={`h-4 w-4 text-[#103D5E] transition-transform duration-300 ${
              collapsed ? 'rotate-180' : ''
            }`} 
          />
        </button>

        <div className="flex flex-col h-full p-4">
          {/* Main Navigation */}
          <div className="space-y-2">
            {navigationItems.map((item) => (
              <NavItem key={item.path} {...item} />
            ))}
          </div>

          {/* Admin Section */}
          {user?.isAdmin && (
            <div className="mt-8 pt-8 border-t border-white/20 space-y-2">
              {adminItems.map((item) => (
                <NavItem key={item.path} {...item} />
              ))}
            </div>
          )}

          {/* Bottom Items */}
          <div className="mt-auto pt-8 border-t border-white/20 space-y-2">
            {bottomItems.map((item) => (
              <NavItem key={item.text} {...item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;