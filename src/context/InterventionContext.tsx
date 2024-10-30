// src/context/InterventionContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';

type InterventionData = {
  clientName: string;
  emissionsAbated: number;
  date: string;
  interventionId: string;
  modality: string;
  geography: string;
  additionality: boolean;
  causality: boolean;
  status: string;
  deliveryTicketNumber: string;
  materialName: string;
  materialId: string;
  vendorName: string;
  quantity: number;
  unit: string;
  amount: number;
  materialSustainabilityStatus: boolean;
  interventionType: string;
  biofuelProduct: string;
  baselineFuelProduct: string;
  typeOfVehicle: string;
  year: string;
  typeOfFeedstock: string;
  emissionReductionPercentage: number;
  intensityOfBaseline: string;
  intensityLowCarbonFuel: string;
  certification: string;
  scope: string;
  thirdPartyVerifier: string;
  standards: string;
};

type InterventionContextType = {
  interventionData: InterventionData[];
  addInterventions: (newData: InterventionData[]) => void;
  clearInterventions: () => void;
  refreshInterventions: () => void;
  error: string | null;
  isLoading: boolean;
};

const InterventionContext = createContext<InterventionContextType | undefined>(undefined);

export const InterventionProvider = ({ children }: { children: React.ReactNode }) => {
  const [interventionData, setInterventionData] = useState<InterventionData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Function to check if the token is expired
  const isTokenExpired = (token: string): boolean => {
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      // Check if the 'exp' claim exists
      if (!decoded.exp) {
        return true;
      }
      return decoded.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  };

  const fetchInterventions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token || isTokenExpired(token)) {
        localStorage.removeItem('token'); // Remove invalid or expired token
        throw new Error('Session expired. Please log in again.');
      }

      console.log('Fetching interventions...');
      const response = await fetch('http://localhost:3001/api/intervention-requests', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 403) {
        localStorage.removeItem('token');
        throw new Error('Access forbidden. Please log in again.');
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const data = await response.json();

      // Transform the data to match InterventionData type if needed
      const transformedData: InterventionData[] = data.map((item: any) => ({
        clientName: item.clientName || '',
        emissionsAbated: parseFloat(item.scope3EmissionsAbated || '0'),
        date: item.submissionDate ? new Date(item.submissionDate).toLocaleDateString() : new Date().toLocaleDateString(),
        interventionId: item.id?.toString() || item.interventionId || '',
        modality: item.modality || '',
        geography: item.geography || '',
        additionality: item.additionality === 'Yes',
        causality: item.causality === 'Yes',
        status: (item.status || '').toLowerCase(),
        deliveryTicketNumber: item.deliveryTicketNumber || '',
        materialName: item.materialName || '',
        materialId: item.materialId || '',
        vendorName: item.vendorName || '',
        quantity: item.quantity || 0,
        unit: item.unit || '',
        amount: item.amount || 0,
        materialSustainabilityStatus: item.materialSustainabilityStatus || false,
        interventionType: item.interventionType || '',
        biofuelProduct: item.biofuelProduct || '',
        baselineFuelProduct: item.baselineFuelProduct || '',
        typeOfVehicle: item.typeOfVehicle || '',
        year: item.year || '',
        typeOfFeedstock: item.typeOfFeedstock || '',
        emissionReductionPercentage: parseFloat(item.emissionReductionPercentage || '0'),
        intensityOfBaseline: item.intensityOfBaseline || '',
        intensityLowCarbonFuel: item.intensityLowCarbonFuel || '',
        certification: item.certification || '',
        scope: item.scope || '',
        thirdPartyVerifier: item.thirdPartyVerifier || '',
        standards: item.standards || ''
      }));

      console.log('Transformed intervention data:', transformedData);
      console.log('Status of interventions:', transformedData.map(item => ({
        id: item.interventionId,
        status: item.status,
        clientName: item.clientName
      })));

      setInterventionData(transformedData);
      localStorage.setItem('interventionData', JSON.stringify(transformedData));
    } catch (error) {
      console.error('Error loading data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data initially and set up interval to refresh
  useEffect(() => {
    fetchInterventions();

    // Refresh data every 30 seconds
    const interval = setInterval(fetchInterventions, 30000);

    return () => clearInterval(interval);
  }, []);

  const addInterventions = (newData: InterventionData[]) => {
    setInterventionData(prev => {
      // Filter out duplicates based on interventionId
      const existingIds = new Set(prev.map(item => item.interventionId));
      const filteredNewData = newData.filter(item => !existingIds.has(item.interventionId));
      return [...prev, ...filteredNewData];
    });
  };

  const clearInterventions = () => {
    setInterventionData([]);
  };

  const refreshInterventions = () => {
    fetchInterventions();
  };

  return (
    <InterventionContext.Provider value={{ 
      interventionData, 
      addInterventions, 
      clearInterventions,
      refreshInterventions,
      error,
      isLoading
    }}>
      {children}
    </InterventionContext.Provider>
  );
};

export const useInterventions = () => {
  const context = useContext(InterventionContext);
  if (context === undefined) {
    throw new Error('useInterventions must be used within an InterventionProvider');
  }
  return context;
};
