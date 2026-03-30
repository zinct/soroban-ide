/**
 * LocalStorage utility for persisting state.
 * Handles save/load with versioning and race condition prevention.
 */

const STORAGE_KEY = 'soroban-studio-state';
const STATE_VERSION = '1.0';

let cachedState = null;
let lastSaved = 0;

export const loadState = () => {
  try {
    if (cachedState) return cachedState;
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) return null;
    const parsed = JSON.parse(serialized);
    if (parsed?._version !== STATE_VERSION) {
      console.log('State version mismatch, resetting state');
      return null;
    }
    cachedState = parsed;
    return parsed;
  } catch (err) {
    console.error('Failed to load state from localStorage:', err);
    return null;
  }
};

export const saveState = (state) => {
  try {
    const now = Date.now();
    if (now - lastSaved < 50) return;
    lastSaved = now;

    const existing = loadState() || {};
    const merged = {
      ...existing,
      ...state,
      _version: STATE_VERSION,
      _lastUpdated: now,
    };

    cachedState = merged;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (err) {
    console.error('Failed to save state to localStorage:', err);
  }
};

export const clearState = () => {
  try {
    cachedState = null;
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear localStorage:', err);
  }
};

export const getStateSection = (section, defaultValue = null) => {
  const state = loadState();
  return state?.[section] ?? defaultValue;
};

export const saveStateSection = (section, data) => {
  const existing = loadState() || {};
  saveState({ ...existing, [section]: data });
};
