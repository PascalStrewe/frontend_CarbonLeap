import React, { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const EmailTest = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const runTest = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/test-email');
      const data = await response.json();
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'not_checked':
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#b9dfd9] to-[#fff2ec] p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/25 backdrop-blur-md rounded-xl shadow-lg border border-white/20 p-8">
          <h1 className="text-2xl font-bold text-[#103D5E] mb-6">Email Configuration Test</h1>
          
          <button
            onClick={runTest}
            disabled={loading}
            className="bg-[#103D5E] text-white px-6 py-3 rounded-lg hover:bg-[#103D5E]/90 transition-all duration-300 disabled:opacity-50 mb-8 flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Running Tests...' : 'Run Tests'}
          </button>

          {error && (
            <div className="mb-6 p-4 bg-red-100/50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {results && (
            <div className="space-y-6">
              <div className="bg-white/20 backdrop-blur-md rounded-lg p-4">
                <h2 className="text-lg font-semibold text-[#103D5E] mb-3 flex items-center gap-2">
                  {getStatusIcon(results.environmentVariables.status)}
                  Environment Variables
                </h2>
                {Object.entries(results.environmentVariables.details).map(([varName, exists]) => (
                  <div key={varName} className="flex items-center gap-2 text-sm">
                    {exists ? 
                      <CheckCircle2 className="h-4 w-4 text-green-500" /> : 
                      <XCircle className="h-4 w-4 text-red-500" />
                    }
                    {varName}
                  </div>
                ))}
                {results.environmentVariables.error && (
                  <p className="text-sm text-red-500 mt-2">{results.environmentVariables.error}</p>
                )}
              </div>

              <div className="bg-white/20 backdrop-blur-md rounded-lg p-4">
                <h2 className="text-lg font-semibold text-[#103D5E] mb-3 flex items-center gap-2">
                  {getStatusIcon(results.graphConnection.status)}
                  Microsoft Graph Connection
                </h2>
                {results.graphConnection.error && (
                  <p className="text-sm text-red-500">{results.graphConnection.error}</p>
                )}
              </div>

              <div className="bg-white/20 backdrop-blur-md rounded-lg p-4">
                <h2 className="text-lg font-semibold text-[#103D5E] mb-3 flex items-center gap-2">
                  {getStatusIcon(results.emailSend.status)}
                  Email Send Test
                </h2>
                {results.emailSend.error && (
                  <p className="text-sm text-red-500">{results.emailSend.error}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailTest;