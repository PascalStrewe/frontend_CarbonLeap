// frontend/src/context/AuthContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// Define the Domain interface
interface Domain {
  id: number;
  name: string;
  companyName: string;
  supplyChainLevel: number;
}

// Updated User interface
interface User {
  id: number;
  email: string;
  isAdmin: boolean;
  domainId: number;
  domain: Domain;
  companyName: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (
    email: string, 
    password: string, 
    companyName: string, 
    domainName: string,
    supplyChainLevel: string
  ) => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const response = await axios.get('/api/validate-token'); // Ensure this endpoint includes domain details
          if (response.data.user) {
            setUser(response.data.user);
            localStorage.setItem('user', JSON.stringify(response.data.user));
          } else {
            logout();
          }
        } catch (error) {
          console.error('Token validation failed:', error);
          logout();
        }
      }
      setIsLoading(false);
    };
    validateToken();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post('/api/login', {
        email,
        password,
      });

      const { token, user } = response.data;
      
      // Set token for future requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Save to localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      setUser(user);
    } catch (error: any) {
      console.error('Login error:', error);
      if (axios.isAxiosError(error)) {
        const serverError = error.response?.data?.message || 'Invalid credentials';
        throw new Error(serverError);
      }
      throw new Error('Invalid credentials');
    }
  };

  const register = async (
    email: string,
    password: string,
    companyName: string,
    domainName: string,
    supplyChainLevel: string
  ) => {
    try {
      const response = await axios.post('/api/register', {
        email,
        password,
        companyName,
        domainName,
        supplyChainLevel
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Registration failed');
      }

      // Don't automatically log in - require email verification in the future
      return response.data;
    } catch (error: any) {
      console.error('Registration error:', error);
      if (axios.isAxiosError(error)) {
        // Log more detailed error information
        console.error('Response data:', error.response?.data);
        console.error('Response status:', error.response?.status);
        
        // Check if we have a specific error message from the server
        const serverError = error.response?.data?.error || error.response?.data?.message;
        if (serverError) {
          throw new Error(serverError);
        } else if (error.response?.status === 500) {
          throw new Error('Server error occurred. Please try again later.');
        }
        // If it's an Axios error but doesn't match above conditions
        throw new Error('Registration failed. Please try again.');
      }
      // If it's not an Axios error, throw the original error
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      register,
      isAuthenticated: !!user,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
