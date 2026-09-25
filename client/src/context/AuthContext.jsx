import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);


export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Cafe-related state
  const [cafes, setCafes] = useState([]);
  const [currentCafe, setCurrentCafe] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);

  const saveToken = useCallback((newToken) => {
    setToken(newToken);
    if (newToken) {
      localStorage.setItem('token', newToken);
    } else {
      localStorage.removeItem('token');
    }
  }, []);

  const fetchCafes = useCallback(async () => {
    try {
      const res = await api.get('/cafes/my');
      const cafeList = res.data.data.cafes;
      setCafes(cafeList);

      // Auto-select the first cafe (or the one saved in localStorage)
      if (cafeList.length > 0) {
        const savedCafeId = localStorage.getItem('currentCafeId');
        const match = cafeList.find((c) => c.cafe._id === savedCafeId) || cafeList[0];
        setCurrentCafe(match.cafe);
        setCurrentRole(match.role);
        localStorage.setItem('currentCafeId', match.cafe._id);
      } else {
        setCurrentCafe(null);
        setCurrentRole(null);
      }
    } catch {
      setCafes([]);
      setCurrentCafe(null);
      setCurrentRole(null);
    }
  }, []);

  // Load user on mount if token exists
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data.data.user);
        return fetchCafes();
      })
      .catch(() => {
        saveToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token, saveToken, fetchCafes]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: newToken, user: userData } = res.data.data;
    saveToken(newToken);
    setUser(userData);
    await fetchCafes();
    return userData;
  };

  const register = async (name, email, phone, password) => {
    const res = await api.post('/auth/register', { name, email, phone, password });
    const { token: newToken, user: userData } = res.data.data;
    saveToken(newToken);
    setUser(userData);
    await fetchCafes();
    return userData;
  };

  const logout = useCallback(() => {
    saveToken(null);
    setUser(null);
    setCafes([]);
    setCurrentCafe(null);
    setCurrentRole(null);
    localStorage.removeItem('currentCafeId');
  }, [saveToken]);

  const selectCafe = useCallback((cafeId) => {
    const match = cafes.find((c) => c.cafe._id === cafeId);
    if (match) {
      setCurrentCafe(match.cafe);
      setCurrentRole(match.role);
      localStorage.setItem('currentCafeId', cafeId);
    }
  }, [cafes]);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    cafes,
    currentCafe,
    currentRole,
    fetchCafes,
    selectCafe,
    hasCafe: cafes.length > 0,
    isStaffOrAbove: ['OWNER', 'MANAGER', 'STAFF'].includes(currentRole),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
