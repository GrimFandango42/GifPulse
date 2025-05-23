import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient"; // Assuming apiRequest handles fetching
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext"; // Import useAuth
import type { UserSettings } from "@shared/schema"; // Import UserSettings type

interface SettingsScreenProps {
  onClose?: () => void; // onClose might not be needed if it's a routed page
}

// Default initial state, matching current defaults
const defaultSettingsState = {
  defaultProvider: "auto",
  autoCheckUpdates: true,
  gifDuration: "5", // Keep as string to match Select component value type
  gifQuality: "high",
  saveHistory: true,
};

export function SettingsScreen({ onClose }: SettingsScreenProps) { // Changed to export function
  const { user, isAuthenticated } = useAuth(); // Get auth status
  const { toast } = useToast();

  // Local state for form fields, initialized with defaults
  const [defaultProvider, setDefaultProvider] = useState(defaultSettingsState.defaultProvider);
  const [autoCheckUpdates, setAutoCheckUpdates] = useState(defaultSettingsState.autoCheckUpdates);
  const [gifDuration, setGifDuration] = useState(defaultSettingsState.gifDuration);
  const [gifQuality, setGifQuality] = useState(defaultSettingsState.gifQuality);
  const [saveHistory, setSaveHistory] = useState(defaultSettingsState.saveHistory);
  // Add state for API keys if it's meant to be editable or displayable from fetched data
  // const [apiKeys, setApiKeys] = useState<Record<string, any> | null>(null);


  // Fetch user settings
  const { 
    data: fetchedSettings, 
    isLoading: isLoadingSettings, 
    isError: isErrorLoadingSettings,
    error: settingsError 
  } = useQuery<UserSettings, Error>({
    queryKey: ['userSettings', user?.id], // User-specific query key
    queryFn: async () => {
      // apiRequest should be configured to send cookies for authenticated requests
      const response = await apiRequest('GET', '/api/settings'); 
      return response.json();
    },
    enabled: isAuthenticated(), // Only run query if user is authenticated
    refetchOnWindowFocus: true,
  });

  // Effect to update local form state when fetchedSettings changes
  useEffect(() => {
    if (fetchedSettings) {
      setDefaultProvider(fetchedSettings.defaultProvider || defaultSettingsState.defaultProvider);
      setAutoCheckUpdates(fetchedSettings.autoCheckUpdates !== null ? fetchedSettings.autoCheckUpdates : defaultSettingsState.autoCheckUpdates);
      setGifDuration(fetchedSettings.gifDuration?.toString() || defaultSettingsState.gifDuration);
      setGifQuality(fetchedSettings.gifQuality || defaultSettingsState.gifQuality);
      setSaveHistory(fetchedSettings.saveHistory !== null ? fetchedSettings.saveHistory : defaultSettingsState.saveHistory);
      // if (fetchedSettings.apiKeys) {
      //   setApiKeys(fetchedSettings.apiKeys);
      // }
    } else if (!isLoadingSettings && !isAuthenticated()) {
      // If not authenticated and not loading, reset to defaults (e.g., after logout)
      setDefaultProvider(defaultSettingsState.defaultProvider);
      setAutoCheckUpdates(defaultSettingsState.autoCheckUpdates);
      setGifDuration(defaultSettingsState.gifDuration);
      setGifQuality(defaultSettingsState.gifQuality);
      setSaveHistory(defaultSettingsState.saveHistory);
    }
  }, [fetchedSettings, isLoadingSettings, isAuthenticated]);


  const saveSettingsMutation = useMutation<UserSettings, Error, Partial<UserSettings>>({
    mutationFn: async (settings) => {
      const res = await apiRequest('POST', '/api/settings', settings);
      return res.json();
    },
    onSuccess: (updatedSettings) => {
      queryClient.invalidateQueries({ queryKey: ['userSettings', user?.id] });
      queryClient.setQueryData(['userSettings', user?.id], updatedSettings); // Optimistically update cache
      toast({
        title: "Settings saved",
        description: "Your preferences have been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to save settings: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const handleSaveSettings = () => {
    const settingsToSave: Partial<Omit<UserSettings, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> = {
      defaultProvider,
      autoCheckUpdates,
      gifDuration: parseInt(gifDuration, 10), // Convert string to number for saving
      gifQuality,
      saveHistory,
      // apiKeys, // Include if apiKeys are editable and part of the form
    };
    saveSettingsMutation.mutate(settingsToSave);
  };
  
  // The `onClose` prop might not be relevant if this is a full page route
  // For now, we'll keep the back button if `onClose` is provided,
  // otherwise it implies it's being used as a full page.

  if (isLoadingSettings && isAuthenticated()) {
    return (
      <div className="flex justify-center items-center h-full">
        <p>Loading your settings...</p>
      </div>
    );
  }

  if (isErrorLoadingSettings && isAuthenticated()) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <p className="text-destructive mb-2">Error loading settings: {settingsError?.message || "Unknown error"}</p>
        <Button onClick={() => queryClient.refetchQueries({ queryKey: ['userSettings', user?.id] })}>
          Try Again
        </Button>
      </div>
    );
  }
  
  // If not authenticated and not loading (initial state or after logout), 
  // it could show a message or rely on ProtectedRoute to redirect.
  // For a dedicated /settings page, ProtectedRoute handles redirection.
  // If this component could somehow be shown without auth (e.g. old modal logic), this check is useful.
  if (!isAuthenticated() && !isLoadingSettings) {
     return (
      <div className="flex justify-center items-center h-full">
        <p>Please log in to view and manage your settings.</p>
      </div>
    );
  }


  return (
    // If this is a full page, we might remove fixed inset-0 and rely on App.tsx layout
    <div className="flex flex-col h-full"> 
      {/* Header (simplified, as App.tsx Header is primary) */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-background z-10">
        <div className="flex items-center">
          {onClose && ( // Only show back button if onClose is provided (modal-like usage)
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full mr-2">
              <span className="material-icons">arrow_back</span>
            </Button>
          )}
          <h2 className="text-lg font-medium text-neutral-dark">Settings</h2>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={handleSaveSettings}
          disabled={saveSettingsMutation.isPending || isLoadingSettings}
        >
          {saveSettingsMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-medium text-neutral-medium mb-3">AI PROVIDER PREFERENCES</h3>
        
        <div className="bg-background rounded-lg shadow-sm border border-gray-200 mb-4">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-neutral-dark font-medium">Default AI Provider</h4>
                <p className="text-neutral-medium text-sm mt-1">Select which AI model to use by default</p>
              </div>
              <Select
                value={defaultProvider}
                onValueChange={setDefaultProvider}
                disabled={isLoadingSettings}
              >
                <SelectTrigger className="w-[180px] bg-muted">
                  <SelectValue placeholder="Auto (Best Result)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (Best Result)</SelectItem>
                  <SelectItem value="openai">OpenAI DALL-E</SelectItem>
                  <SelectItem value="google">Google Imagen</SelectItem>
                  <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-neutral-dark font-medium">Auto-Check for API Updates</h4>
                <p className="text-neutral-medium text-sm mt-1">Automatically check for the latest model versions</p>
              </div>
              <Switch
                checked={autoCheckUpdates}
                onCheckedChange={setAutoCheckUpdates}
                disabled={isLoadingSettings}
              />
            </div>
          </div>
          
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-neutral-dark font-medium">API Keys</h4>
                <p className="text-neutral-medium text-sm mt-1">Manage your AI provider API keys</p>
              </div>
              <Button 
                variant="ghost"
                className="text-primary text-sm font-medium"
                onClick={() => {
                  // This functionality might change or be expanded if API keys are stored in userSettings.apiKeys
                  toast({
                    title: "API Keys Management",
                    description: fetchedSettings?.apiKeys ? "View or edit your API keys." : "API keys are typically managed via server configuration or secure user input.",
                  });
                }}
                disabled={isLoadingSettings}
              >
                Manage
              </Button>
            </div>
          </div>
        </div>
        
        <h3 className="text-sm font-medium text-neutral-medium mb-3 mt-6">GIF SETTINGS</h3>
        
        <div className="bg-background rounded-lg shadow-sm border border-gray-200 mb-4">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-neutral-dark font-medium">GIF Duration</h4>
                <p className="text-neutral-medium text-sm mt-1">Maximum length of generated GIFs</p>
              </div>
              <Select
                value={gifDuration}
                onValueChange={setGifDuration}
                disabled={isLoadingSettings}
              >
                <SelectTrigger className="w-[180px] bg-muted">
                  <SelectValue placeholder="5 seconds" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 seconds</SelectItem>
                  <SelectItem value="5">5 seconds</SelectItem>
                  <SelectItem value="7">7 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-neutral-dark font-medium">GIF Quality</h4>
                <p className="text-neutral-medium text-sm mt-1">Higher quality uses more data</p>
              </div>
              <Select
                value={gifQuality}
                onValueChange={setGifQuality}
                disabled={isLoadingSettings}
              >
                <SelectTrigger className="w-[180px] bg-muted">
                  <SelectValue placeholder="High" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-neutral-dark font-medium">Save History</h4>
                <p className="text-neutral-medium text-sm mt-1">Keep record of your generated GIFs</p>
              </div>
              <Switch
                checked={saveHistory}
                onCheckedChange={setSaveHistory}
                disabled={isLoadingSettings}
              />
            </div>
          </div>
        </div>
        
        <h3 className="text-sm font-medium text-neutral-medium mb-3 mt-6">ABOUT</h3>
        
        <div className="bg-background rounded-lg shadow-sm border border-gray-200 mb-4">
          {/* ... About section remains the same ... */}
           <div className="p-4 border-b border-gray-100">
              <div className="flex items-center">
                <div>
                  <h4 className="text-neutral-dark font-medium">Version</h4>
                  <p className="text-neutral-medium text-sm mt-1">1.0.0</p>
                </div>
              </div>
            </div>
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-neutral-dark font-medium">Privacy Policy</h4>
                </div>
                <span className="material-icons text-neutral-medium">chevron_right</span>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-neutral-dark font-medium">Terms of Service</h4>
                </div>
                <span className="material-icons text-neutral-medium">chevron_right</span>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
