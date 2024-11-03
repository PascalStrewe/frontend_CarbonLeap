import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const message = location.state?.message;
  
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
  }; // Added missing closing brace here
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec] flex items-center justify-center">
      <div className="bg-white/25 backdrop-blur-md p-8 rounded-lg shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] border border-white/20 w-full max-w-md">
        <h2 className="text-2xl font-bold text-[#103D5E] mb-6 text-center">
          Welcome to CarbonLeap
        </h2>

        {message && (
          <div className="bg-green-50/50 backdrop-blur-md text-green-600 p-3 rounded-md mb-4 flex items-center space-x-2">
            <span>{message}</span>
          </div>
        )}
        
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
            className="w-full bg-[#103D5E] text-white rounded-md py-2 hover:bg-[#103D5E]/90 transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin mr-2 h-5 w-5" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
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
            onClick={() => navigate('/register')}
            className="text-sm text-[#103D5E] hover:underline"
          >
            Register now
          </button>
        </div>
      </div>
    </div>
  );
};

export const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    domainName: '',
    supplyChainLevel: '1'
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (formData.companyName.trim().length < 2) {
      setError('Please enter a valid company name');
      return false;
    }
    if (formData.domainName.trim().length < 2) {
      setError('Please enter a valid domain name');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      await register(
        formData.email,
        formData.password,
        formData.companyName,
        formData.domainName,
        formData.supplyChainLevel
      );
      
      navigate('/login', { 
        state: { 
          message: 'Registration successful! Please sign in to continue.' 
        } 
      });
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec] flex items-center justify-center">
      <div className="bg-white/25 backdrop-blur-md p-8 rounded-lg shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] border border-white/20 w-full max-w-md">
        <h2 className="text-2xl font-bold text-[#103D5E] mb-6 text-center">
          Create Your Account
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#103D5E]">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-white/20 bg-white/10 backdrop-blur-md px-3 py-2 text-[#103D5E] focus:border-[#B9D9DF] focus:outline-none focus:ring-1 focus:ring-[#B9D9DF]"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#103D5E]">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-white/20 bg-white/10 backdrop-blur-md px-3 py-2 text-[#103D5E] focus:border-[#B9D9DF] focus:outline-none focus:ring-1 focus:ring-[#B9D9DF]"
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#103D5E]">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-white/20 bg-white/10 backdrop-blur-md px-3 py-2 text-[#103D5E] focus:border-[#B9D9DF] focus:outline-none focus:ring-1 focus:ring-[#B9D9DF]"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#103D5E]">Company Name</label>
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-white/20 bg-white/10 backdrop-blur-md px-3 py-2 text-[#103D5E] focus:border-[#B9D9DF] focus:outline-none focus:ring-1 focus:ring-[#B9D9DF]"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#103D5E]">Domain Name</label>
            <input
              type="text"
              name="domainName"
              value={formData.domainName}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-white/20 bg-white/10 backdrop-blur-md px-3 py-2 text-[#103D5E] focus:border-[#B9D9DF] focus:outline-none focus:ring-1 focus:ring-[#B9D9DF]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#103D5E]">Supply Chain Level</label>
            <select
              name="supplyChainLevel"
              value={formData.supplyChainLevel}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-white/20 bg-white/10 backdrop-blur-md px-3 py-2 text-[#103D5E] focus:border-[#B9D9DF] focus:outline-none focus:ring-1 focus:ring-[#B9D9DF]"
              required
            >
              <option value="1">Level 1 - Raw Materials</option>
              <option value="2">Level 2 - Manufacturing</option>
              <option value="3">Level 3 - Distribution</option>
              <option value="4">Level 4 - Retail</option>
            </select>
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
            className="w-full bg-[#103D5E] text-white rounded-md py-2 hover:bg-[#103D5E]/90 transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin mr-2 h-5 w-5" />
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
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

// Export all components
export default {
  Login,
  Register
};