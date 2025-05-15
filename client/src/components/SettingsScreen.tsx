import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SettingsScreenProps {
  onClose: () => void;
}

export default function SettingsScreen({ onClose }: SettingsScreenProps) {
  const [defaultProvider, setDefaultProvider] = useState("auto");
  const [autoCheckUpdates, setAutoCheckUpdates] = useState(true);
  const [gifDuration, setGifDuration] = useState("5");
  const [gifQuality, setGifQuality] = useState("high");
  const [saveHistory, setSaveHistory] = useState(true);
  const { toast } = useToast();

  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      const res = await apiRequest('POST', '/api/settings', settings);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "Settings saved",
        description: "Your preferences have been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    }
  });

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate({
      defaultProvider,
      autoCheckUpdates,
      gifDuration,
      gifQuality,
      saveHistory
    });
  };

  return (
    <div className="fixed inset-0 bg-white z-30">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <span className="material-icons">arrow_back</span>
            </Button>
            <h2 className="ml-2 text-lg font-medium text-neutral-dark">Settings</h2>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={handleSaveSettings}
            disabled={saveSettingsMutation.isPending}
          >
            Save
          </Button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-neutral-medium mb-3">AI PROVIDER PREFERENCES</h3>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-neutral-dark font-medium">Default AI Provider</h4>
                  <p className="text-neutral-medium text-sm mt-1">Select which AI model to use by default</p>
                </div>
                <Select
                  value={defaultProvider}
                  onValueChange={setDefaultProvider}
                >
                  <SelectTrigger className="w-[180px] bg-neutral-light">
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
                    toast({
                      title: "API Keys",
                      description: "API keys are managed by the system administrator",
                    });
                  }}
                >
                  Manage
                </Button>
              </div>
            </div>
          </div>
          
          <h3 className="text-sm font-medium text-neutral-medium mb-3 mt-6">GIF SETTINGS</h3>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-neutral-dark font-medium">GIF Duration</h4>
                  <p className="text-neutral-medium text-sm mt-1">Maximum length of generated GIFs</p>
                </div>
                <Select
                  value={gifDuration}
                  onValueChange={setGifDuration}
                >
                  <SelectTrigger className="w-[180px] bg-neutral-light">
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
                >
                  <SelectTrigger className="w-[180px] bg-neutral-light">
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
                />
              </div>
            </div>
          </div>
          
          <h3 className="text-sm font-medium text-neutral-medium mb-3 mt-6">ABOUT</h3>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
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
    </div>
  );
}
