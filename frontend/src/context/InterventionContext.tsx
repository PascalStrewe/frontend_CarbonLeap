import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import axios from 'axios';

// Define the shape of your intervention data
export interface InterventionData {
  id?: string;
  userId: number;
  clientName: string;
  emissionsAbated: number;
  date: string; // ISO format
  interventionId: string;
  modality: string;
  geography: string;
  additionality: boolean;
  causality: boolean;
  status: string;
  deliveryTicketNumber?: string;
  materialName?: string;
  materialId?: string;
  vendorName?: string;
  quantity?: number;
  unit?: string;
  amount?: number;
  lowCarbonFuel: string;
  feedstock: string;
  certificationScheme: string;
  ghgEmissionSaving: string;
  vintage: number;
  thirdPartyVerification: string;
  standards?: string;
  otherCertificationScheme?: string;
  vesselType?: string;
  remainingAmount?: number;
}

// Define the context type
interface InterventionContextType {
  interventionData: InterventionData[];
  addInterventions: (newData: InterventionData[]) => void;
  clearInterventions: () => void;
  refreshInterventions: () => Promise<void>;
  error: string | null;
  isLoading: boolean;
}

// Create the context
const InterventionContext = createContext<InterventionContextType | undefined>(
  undefined
);

// Custom hook to use the InterventionContext
export const useInterventions = (): InterventionContextType => {
  const context = useContext(InterventionContext);
  if (context === undefined) {
    throw new Error(
      'useInterventions must be used within an InterventionProvider'
    );
  }
  return context;
};

// Provider component
export const InterventionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [interventionData, setInterventionData] = useState<InterventionData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Function to check if the token is expired
  const isTokenExpired = (token: string): boolean => {
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      if (!decoded.exp) {
        return true;
      }
      return decoded.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  };

  // Function to clear all interventions
  const clearInterventions = useCallback(() => {
    console.log('Clearing intervention data');
    setInterventionData([]);
    localStorage.removeItem('interventionData');
  }, []);

  // Memoized function to fetch interventions
  const fetchInterventions = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('No token available, skipping fetch');
      return;
    }

    if (isTokenExpired(token)) {
      console.log('Token expired, clearing data');
      localStorage.removeItem('token');
      setError('Session expired. Please log in again.');
      clearInterventions();
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching interventions...');
      const response = await axios.get('http://localhost:3001/api/intervention-requests', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const rawData = response.data;
      console.log('Raw response data:', rawData);

      const processedData: InterventionData[] = rawData.map((intervention: any) => {
        console.log('Processing intervention:', {
          id: intervention.interventionId,
          raw: {
            remainingAmount: intervention.remainingAmount,
            emissionsAbated: intervention.emissionsAbated,
            claims: intervention.claims,
            status: intervention.status,
            modality: intervention.modality
          }
        });
        // Parse amounts
        const totalAmount = parseFloat(intervention.totalAmount?.toString() || intervention.emissionsAbated.toString());
        const remainingAmount = typeof intervention.remainingAmount === 'number' ? 
          parseFloat(intervention.remainingAmount.toString()) : 
          parseFloat(intervention.emissionsAbated.toString());
        const emissionsAmount = parseFloat(intervention.emissionsAbated.toString());
      
        // Calculate total active claims amount
        const activeClaims = (intervention.claims || []).reduce((sum: number, claim: any) => {
          if (claim.status === 'active') {
            return sum + parseFloat(claim.amount.toString());
          }
          return sum;
        }, 0);
      
        // Determine if this is a transfer and its direction
        const isTransferFrom = intervention.modality?.toLowerCase().includes('transfer from');
        const isTransferTo = intervention.modality?.toLowerCase().includes('transfer to');
        
        // Get user's domain from localStorage token
        const token = localStorage.getItem('token');
        let userDomain = '';
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            userDomain = payload.domain;
          } catch (e) {
            console.error('Error parsing token:', e);
          }
        }
      
        // Determine the correct status based on transfer direction, ownership, and claims
        let status = intervention.status;
        let effectiveAmount = remainingAmount;
        
        if (isTransferFrom && intervention.clientName?.includes(userDomain)) {
          // This is a received transfer for current user
          status = intervention.status?.toLowerCase() === 'completed' ? 'verified' : intervention.status;
          effectiveAmount = emissionsAmount;
        } else if (isTransferTo && intervention.clientName?.includes(userDomain)) {
          // This is a sent transfer from current user
          // Only mark as transferred if:
          // 1. The entire amount was transferred (remainingAmount === 0)
          // 2. AND there are no active claims
          status = remainingAmount === 0 && activeClaims === 0 ? 'transferred' : intervention.status;
          effectiveAmount = remainingAmount;
        } else if (!isTransferFrom && !isTransferTo) {
          // Original intervention
          status = remainingAmount === 0 && activeClaims === 0 ? 'transferred' : intervention.status;
          effectiveAmount = remainingAmount;
        }
      
        return {
          ...intervention,
          totalAmount,
          remainingAmount: effectiveAmount,
          emissionsAbated: emissionsAmount,
          activeClaims,
          status,
          additionality: intervention.additionality === true || intervention.additionality === 'true',
          causality: intervention.causality === true || intervention.causality === 'true',
          isTransferReceived: isTransferFrom,
          isTransferSent: isTransferTo
        };

        console.log('Processed intervention result:', {
          id: intervention.interventionId,
          processed: {
            remainingAmount: effectiveAmount,
            emissionsAbated: emissionsAmount,
            activeClaims,
            status,
            isTransferFrom,
            isTransferTo
          }
        });
      });

      console.log('Processed intervention data:', processedData);
      setInterventionData(processedData);

    } catch (err: any) {
      console.error('Error fetching interventions:', err);
      setError(
        err.response?.data?.message ||
        err.message ||
        'Failed to fetch intervention data'
      );
      if (err.response?.status === 401 || err.response?.status === 403) {
        clearInterventions();
      }
    } finally {
      setIsLoading(false);
    }
  }, [clearInterventions]);

  // Function to add new interventions without duplicates
  const addInterventions = useCallback((newData: InterventionData[]) => {
    setInterventionData((prevData) => {
      const existingIds = new Set(prevData.map((item) => item.interventionId));
      const filteredNewData = newData.filter(
        (item) => !existingIds.has(item.interventionId)
      );
      const updatedData = [...prevData, ...filteredNewData];
      return updatedData;
    });
  }, []);

  // Check for token changes
  useEffect(() => {
    const token = localStorage.getItem('token');
    console.log('Token changed:', token ? 'Present' : 'Not present');
    setAuthToken(token);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        console.log('Token storage changed:', e.newValue ? 'Present' : 'Not present');
        setAuthToken(e.newValue);
        if (e.newValue) {
          fetchInterventions();
        } else {
          clearInterventions();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [fetchInterventions, clearInterventions]);

  // Set up refresh interval when authenticated
  useEffect(() => {
    if (authToken) {
      console.log('Setting up intervention refresh interval');
      fetchInterventions();

      const interval = setInterval(() => {
        fetchInterventions();
      }, 30000);

      return () => {
        console.log('Clearing intervention refresh interval');
        clearInterval(interval);
      };
    } else {
      clearInterventions();
    }
  }, [authToken, fetchInterventions, clearInterventions]);

  // Expose refreshInterventions as a Promise
  const refreshInterventions = useCallback(async () => {
    await fetchInterventions();
  }, [fetchInterventions]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      interventionData,
      addInterventions,
      clearInterventions,
      refreshInterventions,
      error,
      isLoading,
    }),
    [
      interventionData,
      addInterventions,
      clearInterventions,
      refreshInterventions,
      error,
      isLoading,
    ]
  );

  return (
    <InterventionContext.Provider value={contextValue}>
      {children}
    </InterventionContext.Provider>
  );
};

export default InterventionProvider;