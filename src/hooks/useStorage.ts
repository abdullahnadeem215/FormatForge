import { useState, useEffect } from 'react';
import { 
  getConversionHistory, 
  getPreferences, 
  savePreferences, 
  UserPreferences, 
  ConversionRecord,
  getUserId
} from '../utils/storage';

export function useStorage() {
  const [history, setHistory] = useState<ConversionRecord[]>([]);
  const [preferences, setPreferencesState] = useState<UserPreferences>(getPreferences());
  const [userId] = useState<string>(getUserId());

  // Initial load
  useEffect(() => {
    setHistory(getConversionHistory());
  }, []);

  const updatePreferences = (newPrefs: Partial<UserPreferences>) => {
    const updated = savePreferences(newPrefs);
    setPreferencesState(updated);
  };

  const refreshHistory = () => {
    setHistory(getConversionHistory());
  };

  return { 
    history, 
    preferences, 
    userId,
    updatePreferences, 
    refreshHistory 
  };
}
