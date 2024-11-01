import React, { useState, useEffect } from 'react';
import { Send, X, RefreshCw } from 'lucide-react';

interface Domain {
  id: number;
  name: string;
  companyName: string;
}

interface PartnershipRequestForm {
  domainId: number;
  message: string;
}

const PartnershipRequestModal: React.FC<{
  onClose: () => void;
  onSubmit: (data: PartnershipRequestForm) => Promise<void>;
}> = ({ onClose, onSubmit }) => {
  const [availableDomains, setAvailableDomains] = useState<Domain[]>([]);
  const [formData, setFormData] = useState<PartnershipRequestForm>({
    domainId: 0,
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDomains = async () => {
      try {
        const response = await fetch('/api/domains/available/', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch available domains');
        }
        
        const domains = await response.json();
        setAvailableDomains(domains);
      } catch (err) {
        setError('Failed to load available partners');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDomains();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.domainId) {
      setError('Please select a partner');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white/95 backdrop-blur-md rounded-xl p-6 w-full max-w-lg">
          <div className="flex justify-center items-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-[#103D5E]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/95 backdrop-blur-md rounded-xl p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-[#103D5E]">Request New Partnership</h2>
          <button
            onClick={onClose}
            className="text-[#103D5E]/60 hover:text-[#103D5E] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#103D5E]/70 mb-1">
                Select Partner *
              </label>
              <select
                required
                value={formData.domainId}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  domainId: parseInt(e.target.value)
                }))}
                className="w-full px-3 py-2 bg-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#103D5E]/50"
              >
                <option value="">Select a partner...</option>
                {availableDomains.map((domain) => (
                  <option key={domain.id} value={domain.id}>
                    {domain.companyName} ({domain.name})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#103D5E]/70 mb-1">
                Message (Optional)
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  message: e.target.value
                }))}
                className="w-full px-3 py-2 bg-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#103D5E]/50 h-24 resize-none"
                placeholder="Add a message to introduce your company..."
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                {error}
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-[#103D5E] hover:bg-white/20 rounded-lg transition-all duration-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-[#103D5E] text-white rounded-lg hover:bg-[#103D5E]/90 transition-all duration-300 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PartnershipRequestModal;