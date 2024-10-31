import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  FileText,
  Users,
  Home,
  MessageSquare,
  RefreshCcw,
  Settings,
  Upload,
  Shield, // Added for Claims
} from 'lucide-react';

interface SidebarProps {
  className?: string;
}

interface NavItem {
  label: string;
  icon: React.ComponentType;
  href: string;
  adminOnly?: boolean;
}

export default function Sidebar({ className }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.isAdmin;

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      icon: Home,
      href: '/dashboard',
    },
    {
      label: 'Intervention Requests',
      icon: FileText,
      href: '/request',
    },
    {
      label: 'Carbon Claims',  // New Claims route
      icon: Shield,
      href: '/claims',
    },
    {
      label: 'Carbon Transfers',
      icon: RefreshCcw,
      href: '/transfers',
    },
    {
      label: 'Partnerships',
      icon: Users,
      href: '/partnerships',
    },
    {
      label: 'Analytics',
      icon: BarChart3,
      href: '/analytics',
    },
    {
      label: 'Chat with Data',
      icon: MessageSquare,
      href: '/chat-with-data',
    },
    {
      label: 'Admin Upload',
      icon: Upload,
      href: '/admin/upload',
      adminOnly: true,
    },
    {
      label: 'Settings',
      icon: Settings,
      href: '/settings',
    },
  ];

  return (
    <div className={className}>
      <nav className="space-y-1">
        {navItems.map((item) => {
          if (item.adminOnly && !isAdmin) return null;
          
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-slate-700 hover:bg-gray-100 hover:text-primary'
              }`}
            >
              <Icon className={`mr-3 h-6 w-6 ${
                isActive 
                  ? 'text-white' 
                  : 'text-slate-700 group-hover:text-primary'
              }`} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}