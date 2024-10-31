// src/context/InterventionContext.tsx

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
}

// Define the context type
interface InterventionContextType {
  interventionData: InterventionData[];
  addInterventions: (newData: InterventionData[]) => void;
  clearInterventions: () => void;
  refreshInterventions: () => void;
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
  const [interventionData, setInterventionData] = useState<InterventionData[]>(
    []
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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

  // Memoized function to fetch interventions
  const fetchInterventions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token || isTokenExpired(token)) {
        localStorage.removeItem('token'); // Remove invalid or expired token
        throw new Error('Session expired. Please log in again.');
      }

      console.log('Fetching interventions...');
      const response = await axios.get('/api/intervention-requests', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Assuming the backend returns an array of interventions
      const data: InterventionData[] = response.data;

      console.log('Fetched interventions:', data);
      setInterventionData(data);
      localStorage.setItem('interventionData', JSON.stringify(data));
    } catch (err: any) {
      console.error('Error fetching interventions:', err);
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to fetch intervention data'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Memoized function to refresh interventions
  const refreshInterventions = useCallback(() => {
    fetchInterventions();
  }, [fetchInterventions]);

  // Function to add new interventions without duplicates
  const addInterventions = useCallback((newData: InterventionData[]) => {
    setInterventionData((prevData) => {
      const existingIds = new Set(prevData.map((item) => item.interventionId));
      const filteredNewData = newData.filter(
        (item) => !existingIds.has(item.interventionId)
      );
      const updatedData = [...prevData, ...filteredNewData];
      localStorage.setItem('interventionData', JSON.stringify(updatedData));
      return updatedData;
    });
  }, []);

  // Function to clear all interventions
  const clearInterventions = useCallback(() => {
    setInterventionData([]);
    localStorage.removeItem('interventionData');
  }, []);

  // Initial data fetch and setting up the refresh interval
  useEffect(() => {
    fetchInterventions();

    const interval = setInterval(() => {
      fetchInterventions();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
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
