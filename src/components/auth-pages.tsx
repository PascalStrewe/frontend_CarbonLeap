// C:/Users/PascalStrewe/Downloads/frontend_CarbonLeap/src/components/auth-pages.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// auth-pages.tsx
export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec] flex items-center justify-center">
      <div className="bg-white/25 backdrop-blur-md p-8 rounded-lg shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] border border-white/20 w-full max-w-md">
        <h2 className="text-2xl font-bold text-[#103D5E] mb-6 text-center">
          Welcome to CarbonLeap
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#103D5E]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-white/20 bg-white/10 backdrop-blur-md px-3 py-2 text-[#103D5E] focus:border-[#B9D9DF] focus:outline-none focus:ring-1 focus:ring-[#B9D9DF]"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#103D5E]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-white/20 bg-white/10 backdrop-blur-md px-3 py-2 text-[#103D5E] focus:border-[#B9D9DF] focus:outline-none focus:ring-1 focus:ring-[#B9D9DF]"
              required
            />
          </div>
          
          {error && (
            <div className="bg-red-50/50 backdrop-blur-md text-red-500 p-3 rounded-md flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#103D5E] text-white rounded-md py-2 hover:bg-[#103D5E]/90 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        <div className="mt-4 text-center">
          <a href="#" className="text-sm text-[#103D5E] hover:underline">
            Forgot password?
          </a>
        </div>

        <div className="mt-4 text-center">
          <span className="text-sm text-[#103D5E]/70">New to CarbonLeap? </span>
          <button 
            onClick={() => navigate('/domain-setup')}
            className="text-sm text-[#103D5E] hover:underline"
          >
            Set up your domain
          </button>
        </div>
      </div>
    </div>
  );
};

export const DomainSetup = () => {
  const [domainName, setDomainName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Add your domain setup logic here
    try {
      // Handle domain setup
      navigate('/login');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec] flex items-center justify-center">
      <div className="bg-white/25 backdrop-blur-md p-8 rounded-lg shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] border border-white/20 w-full max-w-md">
        <h2 className="text-2xl font-bold text-[#103D5E] mb-6 text-center">
          Set Up Your Domain
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#103D5E]">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-white/20 bg-white/10 backdrop-blur-md px-3 py-2 text-[#103D5E] focus:border-[#B9D9DF] focus:outline-none focus:ring-1 focus:ring-[#B9D9DF]"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#103D5E]">Domain Name</label>
            <input
              type="text"
              value={domainName}
              onChange={(e) => setDomainName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-white/20 bg-white/10 backdrop-blur-md px-3 py-2 text-[#103D5E] focus:border-[#B9D9DF] focus:outline-none focus:ring-1 focus:ring-[#B9D9DF]"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-[#103D5E] text-white rounded-md py-2 hover:bg-[#103D5E]/90 transition-colors"
          >
            Set Up Domain
          </button>
        </form>
        
        <div className="mt-4 text-center">
          <span className="text-sm text-[#103D5E]/70">Already have an account? </span>
          <button 
            onClick={() => navigate('/login')}
            className="text-sm text-[#103D5E] hover:underline"
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
};
