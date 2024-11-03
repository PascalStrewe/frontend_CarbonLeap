import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

const Register = () => {
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
  const navigate = useNavigate();
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error when user types
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    // Basic validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }
    
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setIsLoading(false);
      return;
    }
    
    try {
      // First create the domain
      const domainResponse = await axios.post('/api/domains', {
        companyName: formData.companyName,
        domainName: formData.domainName,
        supplyChainLevel: parseInt(formData.supplyChainLevel)
      });
      
      // Then create the user account
      const userResponse = await axios.post('/api/users', {
        email: formData.email,
        password: formData.password,
        domainId: domainResponse.data.data.id,
        isAdmin: false
      });
      
      // After successful registration, redirect to login
      navigate('/login', { 
        state: { 
          message: 'Registration successful! Please log in.' 
        } 
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec] flex items-center justify-center">
      <div className="bg-white/25 backdrop-blur-md p-8 rounded-lg shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] border border-white/20 w-full max-w-md">
        <h2 className="text-2xl font-bold text-[#103D5E] mb-6 text-center">
          Register for CarbonLeap
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
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
            >
              <option value="1">Level 1 - Raw Material Supplier</option>
              <option value="2">Level 2 - Manufacturer</option>
              <option value="3">Level 3 - Distributor</option>
              <option value="4">Level 4 - Retailer</option>
            </select>
          </div>
          
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
                Registering...
              </>
            ) : (
              'Register'
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

export default Register;