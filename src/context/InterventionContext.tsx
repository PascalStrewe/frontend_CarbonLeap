import React, { createContext, useContext, useState } from 'react';

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
};

type InterventionContextType = {
  interventionData: InterventionData[];
  addInterventions: (newData: InterventionData[]) => void;
  clearInterventions: () => void;
};

const InterventionContext = createContext<InterventionContextType | undefined>(undefined);

export const InterventionProvider = ({ children }: { children: React.ReactNode }) => {
  const [interventionData, setInterventionData] = useState<InterventionData[]>([]);

  const addInterventions = (newData: InterventionData[]) => {
    setInterventionData(prev => [...prev, ...newData]);
  };

  const clearInterventions = () => {
    setInterventionData([]);
  };

  return (
    <InterventionContext.Provider value={{ interventionData, addInterventions, clearInterventions }}>
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