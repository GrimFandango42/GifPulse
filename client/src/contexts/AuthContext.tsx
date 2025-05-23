import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { User, UserSettings } from '@shared/schema'; // Assuming User type from shared schema
import { apiRequest } from '@/lib/queryClient'; // Assuming apiRequest for authenticated calls

// Define default settings values
const defaultUserSettings: Pick<UserSettings, 'gifDuration' | 'gifQuality'> = {
  gifDuration: 5, // Default duration in seconds
  gifQuality: 'high', // Default quality
};

interface AuthContextType {
  user: User | null;
  userSettings: Pick<UserSettings, 'gifDuration' | 'gifQuality'>;
  isLoading: boolean;
  isLoadingSettings: boolean; // For settings loading state
  login: (credentials: LoginCredentials) => Promise<User>;
  register: (details: RegisterDetails) => Promise<User>;
  logout: () => Promise<void>;
  isAuthenticated: () => boolean;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface RegisterDetails extends LoginCredentials {}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null); // Local state for user

  // Fetch session on initial load
  const { data: sessionData, isLoading: isLoadingSession } = useQuery<{ user: User | null }>({
    queryKey: ['session'],
    queryFn: async () => {
      const res = await fetch('/api/auth/session'); // Standard fetch for public endpoint
      if (!res.ok) throw new Error('Failed to fetch session');
      return res.json();
    },
    retry: false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (sessionData) {
      setUser(sessionData.user);
    } else if (!isLoadingSession) { // If no sessionData and not loading, means no active session
      setUser(null);
    }
  }, [sessionData, isLoadingSession]);

  // Fetch user settings when user is authenticated
  const { data: fetchedUserSettings, isLoading: isLoadingUserSettings } = useQuery<UserSettings, Error>({
    queryKey: ['userSettings', user?.id], // User-specific query key for settings
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/settings'); // Use apiRequest for authenticated endpoint
      if (!response.ok) throw new Error('Failed to fetch user settings');
      return response.json();
    },
    enabled: !!user, // Only run query if user is authenticated
    refetchOnWindowFocus: true,
  });
  
  const userSettings = {
    gifDuration: fetchedUserSettings?.gifDuration ?? defaultUserSettings.gifDuration,
    gifQuality: fetchedUserSettings?.gifQuality ?? defaultUserSettings.gifQuality,
  };

  const loginMutation = useMutation<User, Error, LoginCredentials>({
    mutationFn: async (credentials) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(errorData.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      setUser(data);
      queryClient.invalidateQueries({ queryKey: ['session'] });
      // Settings will be refetched due to 'enabled: !!user' and user state change
      queryClient.invalidateQueries({ queryKey: ['userSettings', data?.id] }); 
    },
  });

  const registerMutation = useMutation<User, Error, RegisterDetails>({
    mutationFn: async (details) => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Registration failed' }));
        throw new Error(errorData.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      setUser(data); // This will trigger session refetch and subsequently settings refetch
      queryClient.invalidateQueries({ queryKey: ['session'] });
      queryClient.invalidateQueries({ queryKey: ['userSettings', data?.id] });
    },
  });

  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Logout failed' }));
        throw new Error(errorData.message);
      }
    },
    onSuccess: () => {
      setUser(null); // User becomes null
      queryClient.setQueryData(['session'], { user: null }); // Update session cache
      queryClient.removeQueries({ queryKey: ['userSettings'] }); // Clear user settings cache
    },
  });

  const isAuthenticated = useCallback(() => {
    return !!user;
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        userSettings,
        isLoading: isLoadingSession || loginMutation.isPending || registerMutation.isPending || logoutMutation.isPending,
        isLoadingSettings: isLoadingUserSettings,
        login: loginMutation.mutateAsync,
        register: registerMutation.mutateAsync,
        logout: logoutMutation.mutateAsync,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
