
import { useContext } from 'react';
import { DataContext, DataContextType } from '../context/DataContext';

export function useData(): DataContextType {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }

  const { rsEngineData, vrsData, ...rest } = context;

  return { ...rest, rsEngineData, vrsData };
}
