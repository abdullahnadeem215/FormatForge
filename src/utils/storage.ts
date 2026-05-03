// All localStorage utility functions for FormatForge

import { storeFileBlob, deleteFileBlob, clearFileBlobs } from './db';

export interface ConversionRecord {
  id: string;
  type: 'image' | 'audio' | 'video' | 'document';
  input_format: string;
  output_format: string;
  file_name: string;
  input_size: number;
  output_size: number;
  created_at: string;
  status: 'completed' | 'failed';
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  defaultOutputFormat: string;
  defaultQuality: number;
  autoSaveHistory: boolean;
}

const defaultPreferences: UserPreferences = {
  theme: 'dark',
  defaultOutputFormat: 'webp',
  defaultQuality: 90,
  autoSaveHistory: true
};

export const getUserId = (): string => {
  let userId = localStorage.getItem('formatforge_user_id');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    localStorage.setItem('formatforge_user_id', userId);
  }
  return userId;
};

export const getConversionHistory = (): ConversionRecord[] => {
  try {
    const data = localStorage.getItem('formatforge_history');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to parse conversion history from localStorage', e);
    return [];
  }
};

export const saveConversion = (record: Omit<ConversionRecord, 'id' | 'created_at'>, blob?: Blob): ConversionRecord => {
  const newRecord: ConversionRecord = {
    ...record,
    id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 10)}_${Math.floor(Math.random() * 1000)}`,
    created_at: new Date().toISOString()
  };
  
  // Save blob if provided
  if (blob) {
    storeFileBlob(newRecord.id, blob, newRecord.file_name).catch(console.error);
  }
  
  const history = getConversionHistory();
  history.unshift(newRecord);
  
  // Keep only last 100 conversions to avoid localStorage limits
  const trimmed = history.slice(0, 100);
  try {
    localStorage.setItem('formatforge_history', JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to save conversion to localStorage', e);
  }
  return newRecord;
};

export const clearHistory = (): void => {
  localStorage.removeItem('formatforge_history');
  clearFileBlobs().catch(console.error);
};

export const deleteConversion = (id: string): void => {
  const history = getConversionHistory();
  const filtered = history.filter(record => record.id !== id);
  localStorage.setItem('formatforge_history', JSON.stringify(filtered));
  deleteFileBlob(id).catch(console.error);
};

export const getPreferences = (): UserPreferences => {
  try {
    const prefs = localStorage.getItem('formatforge_preferences');
    return prefs ? { ...defaultPreferences, ...JSON.parse(prefs) } : defaultPreferences;
  } catch (e) {
    return defaultPreferences;
  }
};

export const savePreferences = (prefs: Partial<UserPreferences>): UserPreferences => {
  const current = getPreferences();
  const updated = { ...current, ...prefs };
  localStorage.setItem('formatforge_preferences', JSON.stringify(updated));
  return updated;
};
