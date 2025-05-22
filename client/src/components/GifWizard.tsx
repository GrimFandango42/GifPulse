import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GifThumbnail from "@/components/GifThumbnail";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Removed unused TabsContent
import { useToast } from "@/hooks/use-toast";
import { GifSearchResponseSchema } from "../../../shared/schema"; 

/**
 * @file GifWizard.tsx - Main component for the GIF generation wizard.
 * Handles user input, API calls for GIF generation, and display of results.
 * Relies on server-side GIF generation and receives Base64 data URLs.
 */

type AiProvider = "auto" | "openai" | "google" | "anthropic";
type ScreenState = "search" | "generating" | "result" | "error";

interface GifWizardProps {
  /** Function to call when the wizard is closed. */
  onClose: () => void;
  /** Function to call when a GIF (as a data URL) is selected to be sent. */
  onGifSelect: (gifUrl: string) => void;
  /** Function to call to open the settings screen. */
  onOpenSettings: () => void;
}

/**
 * Main UI component for the GIF generation wizard.
 * It allows users to search for GIFs, select an AI provider,
 * view generation progress, and see the results.
 * All GIF and thumbnail data is received as Base64 data URLs from the server.
 */
export default function GifWizard({ 
  onClose, 
  onGifSelect,
  onOpenSettings
}: GifWizardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>("auto");
  const [screenState, setScreenState] = useState<ScreenState>("search");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Enter a prompt to start..."); // Initial message
  
  const [currentGeneratedGifUrl, setCurrentGeneratedGifUrl] = useState<string | null>(null);
  const [currentThumbnailUrl, setCurrentThumbnailUrl] = useState<string | null>(null);
  
  // Variations are currently not populated by the /api/gif/generate endpoint in its current form.
  // const [variations, setVariations] = useState<string[]>([]); 
  // const [selectedVariation, setSelectedVariation] = useState(0);
  const { toast } = useToast();
  
  // Fetch recent GIF searches
  const { data: recentSearches, isLoading: isLoadingRecent } = useQuery<GifSearchResponseSchema[]>({
    queryKey: ['/api/gif/searches'], 
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/gif/searches');
      return res.json();
    }
  });

  // Fetch popular GIF searches (Placeholder - requires a dedicated backend endpoint)
  const { data: popularSearches, isLoading: isLoadingPopular } = useQuery<GifSearchResponseSchema[]>({
    queryKey: ['/api/gif/popular'], 
     queryFn: async () => {
      console.warn("Popular searches API endpoint is not implemented. Returning empty array.");
      return Promise.resolve([]); 
    }
  });

  // Mutation for generating a new GIF via the server
  const generateGifMutation = useMutation({
    mutationFn: async (data: { query: string, provider: AiProvider }) => {
      const res = await apiRequest('POST', '/api/gif/generate', data);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to generate GIF. Network error or non-JSON response." }));
        throw new Error(errorData.error || `Failed to generate GIF. Status: ${res.status}`);
      }
      return res.json() as Promise<GifSearchResponseSchema>;
    },
    onSuccess: (data) => {
      setCurrentGeneratedGifUrl(data.gifUrl);
      setCurrentThumbnailUrl(data.thumbnailUrl);
      // setVariations([]); // Reset variations as they are not handled in this simplified version
      setScreenState("result");
      queryClient.invalidateQueries({ queryKey: ['/api/gif/searches'] });
    },
    onError: (error: Error) => {
      console.error("Error generating GIF:", error);
      setScreenState("error");
      toast({
        title: "Error Generating GIF",
        description: error.message || "An unknown error occurred. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Effect for managing progress bar and status messages during generation
  useEffect(() => {
    if (screenState === "generating") {
      const messages = [
        "Contacting AI provider...",
        "AI is thinking...",
        "Generating image frames...",
        "Server is encoding GIF...",
        "Almost ready...",
      ];
      let messageIdx = 0;
      setProgress(10); 
      setStatusMessage(messages[messageIdx]);

      const interval = setInterval(() => {
        if (!generateGifMutation.isPending) {
          clearInterval(interval);
          setProgress(100);
          setStatusMessage("GIF ready!");
          return;
        }
        
        setProgress((prev) => Math.min(prev + Math.floor(Math.random() * 10) + 5, 95) );
        
        // Cycle through messages based on progress, but don't go past "Almost ready..." while pending
        messageIdx = Math.min(Math.floor(progress / (95 / (messages.length -1))), messages.length - 2);
        setStatusMessage(messages[messageIdx]);

      }, 700); // Adjusted interval timing

      return () => clearInterval(interval);
    }
  }, [screenState, generateGifMutation.isPending, progress]); // Added progress to dependency array

  /** Handles the submission of the GIF generation request. */
  const handleGenerateGif = () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Empty Prompt",
        description: "Please enter a search query for your GIF.",
        variant: "destructive",
      });
      return;
    }
    
    setScreenState("generating");
    setProgress(0); 
    setCurrentGeneratedGifUrl(null); 
    setCurrentThumbnailUrl(null);
    
    generateGifMutation.mutate({
      query: searchQuery,
      provider: selectedProvider
    });
  };

  /** Handles sending the currently displayed GIF. */
  const handleSendGif = () => {
    if (currentGeneratedGifUrl) {
      onGifSelect(currentGeneratedGifUrl); 
    } else {
        toast({
            title: "No GIF Ready",
            description: "A GIF needs to be generated before it can be sent.",
            variant: "warning"
        });
    }
  };

  /** Handles regenerating the GIF with the current query and provider. */
  const handleRegenerateGif = () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Empty Prompt",
        description: "Cannot regenerate without a prompt.",
        variant: "warning",
      });
      return;
    }
    setScreenState("generating");
    setProgress(0);
    setCurrentGeneratedGifUrl(null);
    setCurrentThumbnailUrl(null);
    
    generateGifMutation.mutate({
      query: searchQuery, 
      provider: selectedProvider
    });
  };

  // Variation handling is currently disabled as server does not provide them in this flow.
  // const handleVariationSelect = (index: number) => {
  //   if (variations[index]) {
  //     setSelectedVariation(index);
  //     setCurrentGeneratedGifUrl(variations[index]); 
  //     setCurrentThumbnailUrl(variations[index]); 
  //   }
  // };

  /** Resets the wizard to the search state, optionally clearing the query. */
  const handleTryAgain = () => {
    setScreenState("search");
    // setSearchQuery(""); // Optional: clear search query on try again
  };

  /** Handles selecting a GIF from the recent searches list. */
  const handleSelectRecentGif = (item: GifSearchResponseSchema) => {
    setSearchQuery(item.query);
    setCurrentGeneratedGifUrl(item.gifUrl);
    setCurrentThumbnailUrl(item.thumbnailUrl);
    setScreenState("result");
  };

  /** Handles key down event for submitting search with Enter key. */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !generateGifMutation.isPending) {
      handleGenerateGif();
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-20 flex items-end justify-center">
      <div className="bg-white rounded-t-xl shadow-lg slide-up w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg font-medium text-neutral-dark">GIF Wizard</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <span className="material-icons">close</span>
          </Button>
        </div>
        
        {/* Search Input Area */}
        <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="relative">
            <Input
              type="text"
              id="gifSearchInput"
              placeholder="Describe the GIF you want to create..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-neutral-light rounded-full px-4 py-2 pl-10 pr-24 outline-none focus-visible:ring-primary"
              disabled={screenState === "generating"}
            />
            <span className="material-icons absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-medium">search</span>
            <Button
              onClick={handleGenerateGif}
              disabled={screenState === "generating" || !searchQuery.trim()}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-primary text-white px-3 py-1 rounded-full text-sm font-medium hover:bg-primary-dark"
            >
              {screenState === "generating" ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
        
        {/* AI Provider Tabs */}
        <Tabs defaultValue="auto" onValueChange={(value) => setSelectedProvider(value as AiProvider)} className="flex-shrink-0">
          <TabsList className="px-2 border-b border-gray-200 flex overflow-x-auto hide-scrollbar w-full justify-start h-12 bg-transparent">
            <TabsTrigger value="auto" className="px-3 py-2 text-sm font-medium flex-shrink-0 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none text-neutral-medium">
              Auto
            </TabsTrigger>
            <TabsTrigger value="openai" className="px-3 py-2 text-sm font-medium flex-shrink-0 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none text-neutral-medium">
              OpenAI
            </TabsTrigger>
            <TabsTrigger value="google" className="px-3 py-2 text-sm font-medium flex-shrink-0 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none text-neutral-medium">
              Google
            </TabsTrigger>
            <TabsTrigger value="anthropic" className="px-3 py-2 text-sm font-medium flex-shrink-0 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none text-neutral-medium">
              Anthropic
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        {/* Content Area (Search History, Generating, Result, Error) */}
        <div className="flex-1 overflow-y-auto">
          {screenState === "search" && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-neutral-medium">RECENT SEARCHES</h3>
                <Button variant="ghost" size="sm" onClick={onOpenSettings} className="text-sm text-primary hover:bg-primary-lightest">
                  Settings
                </Button>
              </div>
              {isLoadingRecent ? (<p className="text-neutral-medium text-sm">Loading recent searches...</p>) : 
               !recentSearches || recentSearches.length === 0 ? (<p className="text-neutral-medium text-sm">No recent searches yet.</p>) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {recentSearches.map((item) => (
                    <GifThumbnail
                      key={item.id}
                      query={item.query}
                      gifUrl={item.thumbnailUrl || item.gifUrl}
                      onClick={() => handleSelectRecentGif(item)}
                    />
                  ))}
                </div>
              )}
              
              <h3 className="text-sm font-medium text-neutral-medium mt-6 mb-3">POPULAR SEARCHES</h3>
              {isLoadingPopular ? (<p className="text-neutral-medium text-sm">Loading popular searches...</p>) : 
               !popularSearches || popularSearches.length === 0 ? (<p className="text-neutral-medium text-sm">No popular searches available.</p>) : (
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {popularSearches.map((item) => (
                    <GifThumbnail
                      key={item.id}
                      query={item.query}
                      gifUrl={item.thumbnailUrl || item.gifUrl}
                      onClick={() => handleSelectRecentGif(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          
          {screenState === "generating" && (
            <div className="flex flex-col items-center justify-center p-6 h-full">
              <div className="w-full max-w-md text-center">
                <div className="aspect-video bg-neutral-light rounded-lg overflow-hidden mb-4 relative flex items-center justify-center">
                    <div className="loading-spinner w-10 h-10 border-4 border-neutral-light rounded-full"></div>
                </div>
                <p className="text-neutral-dark mt-2 text-sm font-medium">Creating your GIF on the server...</p>
                <p className="text-neutral-medium text-xs mt-1 mb-2">{statusMessage}</p>
                <div className="w-full bg-neutral-light rounded-full h-2 mb-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-xs text-neutral-medium">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Button 
                  variant="ghost"
                  className="w-full py-2 mt-4 text-primary hover:bg-primary-lightest"
                  onClick={() => {
                    generateGifMutation.reset(); 
                    setScreenState("search");
                  }}
                >
                  Cancel Generation
                </Button>
              </div>
            </div>
          )}
          
          {screenState === "result" && currentGeneratedGifUrl && (
            <div className="p-6 flex flex-col items-center">
              <div className="w-full max-w-md">
                <div className="bg-neutral-light rounded-lg overflow-hidden mb-4">
                  <img 
                    src={currentGeneratedGifUrl} 
                    alt={searchQuery || "Generated GIF"}
                    className="w-full object-contain max-h-[350px] mx-auto"
                  />
                </div>
                <div className="flex space-x-2 mb-4">
                  <Button variant="default" className="flex-1" onClick={handleSendGif}>
                    <span className="material-icons mr-1 text-sm">send</span>Send
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={handleRegenerateGif}>
                    <span className="material-icons mr-1 text-sm">refresh</span>Regenerate
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => {
                      navigator.clipboard.writeText(currentGeneratedGifUrl).then(() => {
                         toast({ title: "Copied!", description: "GIF Data URL copied."});
                      }, () => {
                         toast({ title: "Copy Failed", variant: "destructive"});
                      });
                    }}
                  >
                    <span className="material-icons text-sm">share</span>
                  </Button>
                </div>
                <div className="text-xs text-neutral-medium">
                  <p><strong>Prompt:</strong> {searchQuery}</p>
                  <p><strong>Provider:</strong> {selectedProvider === "auto" ? "Default" : selectedProvider}</p>
                </div>
                {/* Variations UI commented out as it's not fully functional with current server response
                {variations.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-neutral-dark mb-1">Variations (Example)</h3>
                    <div className="flex space-x-2 overflow-x-auto pb-2 hide-scrollbar">
                      {variations.map((variationUrl, index) => (
                        <div 
                          key={index}
                          className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer ${
                            selectedVariation === index ? 'border-2 border-primary' : ''
                          }`}
                          onClick={() => handleVariationSelect(index)}
                        >
                          <img 
                            src={variationUrl}
                            alt={`Variation ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                */}
              </div>
            </div>
          )}
          
          {screenState === "error" && (
            <div className="flex flex-col items-center justify-center p-6 text-center h-full">
              <span className="material-icons text-destructive text-5xl mb-2">error_outline</span>
              <h3 className="text-neutral-dark font-medium text-lg">GIF Generation Failed</h3>
              <p className="text-neutral-medium text-sm mt-1 mb-4">
                We encountered an error while trying to create your GIF. Please try a different prompt or provider.
              </p>
              <Button variant="default" onClick={handleTryAgain}>
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
