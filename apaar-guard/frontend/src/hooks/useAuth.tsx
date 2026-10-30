import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isOfficer: boolean;
  isRegulator: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const data = await api.get<User>('/auth/me', { useCache: false });
      setUser(data);
    } catch (err: any) {
      // 401 is the standard, expected HTTP status for an unauthenticated user:
      // Gracefully set the state to logged out without scary errors or redirect loops
      if (err?.status === 401) {
        try {
          localStorage.removeItem('apaar_token');
        } catch {
          // Storage unavailable
        }
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ access_token: string; user: User }>('/auth/login', {
      email,
      password,
    });
    if (res.access_token) {
      try {
        localStorage.setItem('apaar_token', res.access_token);
      } catch {
        // Storage unavailable
      }
    }
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Gracefully handle network disconnect during logout
    } finally {
      try {
        localStorage.removeItem('apaar_token');
      } catch {
        // Storage unavailable
      }
      setUser(null);
    }
  };

  const isAdmin = user?.role === 'institution_admin';
  const isOfficer = user?.role === 'verification_officer';
  const isRegulator = user?.role === 'regulator';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        isOfficer,
        isRegulator,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
