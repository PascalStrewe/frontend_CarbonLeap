import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Settings, 
  LogOut, 
  Bell, 
  Search,
  Menu,
  X
} from 'lucide-react';

const Navigation = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const notifications = [
    { id: 1, text: "New intervention request", time: "5m ago" },
    { id: 2, text: "Project verification completed", time: "1h ago" },
    { id: 3, text: "Monthly report available", time: "2h ago" },
  ];

  return (
    <nav className="backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center px-4 py-2">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4">
            <img 
              src="/images/logo_CarbonLeap.webp"
              alt="CarbonLeap Logo" 
              className="h-16 w-auto"
            />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                className="w-64 px-4 py-2 pl-10 bg-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#103D5E]/20 transition-all duration-300"
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-[#103D5E]/50" />
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 hover:bg-white/20 rounded-lg transition-all duration-300 relative"
              >
                <Bell className="h-5 w-5 text-[#103D5E]" />
                <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white/95 backdrop-blur-lg rounded-lg shadow-lg py-2 border border-white/20">
                  {notifications.map(notification => (
                    <div key={notification.id} className="px-4 py-3 hover:bg-white/50 transition-colors duration-200">
                      <p className="text-sm text-[#103D5E]">{notification.text}</p>
                      <p className="text-xs text-[#103D5E]/60 mt-1">{notification.time}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="px-4 py-2 bg-white/10 rounded-lg backdrop-blur-md">
              <span className="text-[#103D5E] font-medium">Welcome, {user?.name}</span>
            </div>

            {/* Settings */}
            <button 
              className="text-[#103D5E] hover:bg-white/20 p-2 rounded-lg transition-all duration-300"
              onClick={() => navigate('/settings')}
            >
              <Settings className="h-5 w-5" />
            </button>

            {/* Logout */}
            <button 
              className="text-[#103D5E] hover:bg-white/20 p-2 rounded-lg transition-all duration-300"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 hover:bg-white/20 rounded-lg transition-all duration-300"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            {showMobileMenu ? (
              <X className="h-6 w-6 text-[#103D5E]" />
            ) : (
              <Menu className="h-6 w-6 text-[#103D5E]" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="md:hidden px-4 py-2 bg-white/95 backdrop-blur-lg border-t border-white/10">
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full px-4 py-2 pl-10 bg-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#103D5E]/20"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-[#103D5E]/50" />
              </div>
              
              <button 
                className="w-full text-left px-4 py-2 text-[#103D5E] hover:bg-white/20 rounded-lg transition-all duration-300"
                onClick={() => navigate('/settings')}
              >
                Settings
              </button>
              
              <button 
                className="w-full text-left px-4 py-2 text-[#103D5E] hover:bg-white/20 rounded-lg transition-all duration-300"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;