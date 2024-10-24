import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  email: string;
  isAdmin: boolean;
  domain: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, domain?: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Mock users database
const MOCK_USERS = [
  {
    email: 'admin@carbonleap.nl',
    password: 'admin123',
    isAdmin: true,
    domain: 'carbonleap.nl'
  },
  {
    email: 'user@postnl.com',
    password: 'user123',
    isAdmin: false,
    domain: 'postnl.com'
  }
];

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for saved auth state
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const matchedUser = MOCK_USERS.find(u => u.email === email && u.password === password);
    
    if (!matchedUser) {
      throw new Error('Invalid credentials');
    }

    const userObj = {
      email: matchedUser.email,
      isAdmin: matchedUser.isAdmin,
      domain: matchedUser.domain
    };

    setUser(userObj);
    localStorage.setItem('user', JSON.stringify(userObj));
  };

  const register = async (email: string, password: string, domain?: string) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Extract domain from email if not provided
    const emailDomain = domain || email.split('@')[1];
    
    // Check if domain already exists (except for admin domain)
    const domainExists = MOCK_USERS.some(u => 
      !u.isAdmin && u.domain === emailDomain
    );

    if (domainExists) {
      throw new Error('This domain is already registered');
    }

    // In a real app, you would save this to a database
    const newUser = {
      email,
      password,
      isAdmin: false,
      domain: emailDomain
    };

    MOCK_USERS.push(newUser);
    
    // Auto login after registration
    await login(email, password);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};