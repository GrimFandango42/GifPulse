import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient"; // Combined imports
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GifThumbnail from "@/components/GifThumbnail";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
// Removed: import { useGifCreator } from "@/hooks/use-gif-creator";
import { GifSearchResponseSchema } from "../../../shared/schema"; // For API response type

type AiProvider = "auto" | "openai" | "google" | "anthropic";
type ScreenState = "search" | "generating" | "result" | "error";

interface GifWizardProps {
  onClose: () => void;
  onGifSelect: (gifUrl: string) => void; // This will now be a data URL
  onOpenSettings: () => void;
}

export default function GifWizard({ 
  onClose, 
  onGifSelect,
  onOpenSettings
}: GifWizardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>("auto");
  const [screenState, setScreenState] = useState<ScreenState>("search");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Analyzing your request...");
  
  // State to hold the Base64 data URL of the generated GIF from the server
  const [currentGeneratedGifUrl, setCurrentGeneratedGifUrl] = useState<string | null>(null);
  // State to hold the Base64 data URL of the thumbnail from the server
  const [currentThumbnailUrl, setCurrentThumbnailUrl] = useState<string | null>(null);
  
  const [variations, setVariations] = useState<string[]>([]); // Assuming variations are still single image URLs/dataURLs
  const [selectedVariation, setSelectedVariation] = useState(0);
  const { toast } = useToast();
  
  // Removed: const { createGif, isCreating, progress: gifCreationProgress } = useGifCreator();

  // Fetch recent searches (remains the same)
  const { data: recentSearches, isLoading: isLoadingRecent } = useQuery<GifSearchResponseSchema[]>({
    queryKey: ['/api/gif/searches'], // Assuming this is how recent searches are fetched
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/gif/searches');
      return res.json();
    }
  });

  // Fetch popular searches (remains the same, assuming similar structure)
  const { data: popularSearches, isLoading: isLoadingPopular } = useQuery<GifSearchResponseSchema[]>({
    queryKey: ['/api/gif/popular'], // Assuming this is how popular searches are fetched
     queryFn: async () => {
      // Replace with actual API call if different from recent searches
      // For now, using a placeholder if no dedicated popular endpoint exists or structure differs
      // This might involve a different API endpoint or parameters
      // const res = await apiRequest('GET', '/api/gif/popular');
      // return res.json();
      console.warn("Popular searches API endpoint not specified, using empty array as placeholder.");
      return Promise.resolve([]); 
    }
  });

  // Generate GIF mutation
  const generateGifMutation = useMutation({
    mutationFn: async (data: { query: string, provider: AiProvider }) => {
      // The server now handles all GIF generation and returns data URLs
      const res = await apiRequest('POST', '/api/gif/generate', data);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to generate GIF. Network error." }));
        throw new Error(errorData.error || "Failed to generate GIF.");
      }
      return res.json() as Promise<GifSearchResponseSchema>; // Server returns gifUrl and thumbnailUrl as data URLs
    },
    onSuccess: (data) => {
      // Server now provides the final GIF and thumbnail as data URLs
      setCurrentGeneratedGifUrl(data.gifUrl);
      setCurrentThumbnailUrl(data.thumbnailUrl); // Use the server-provided thumbnail
      
      // Variations might still be a concept, but they'd be single images (data URLs)
      // setVariations(data.variations || []); // Assuming server might provide variations
      setVariations([]); // Reset variations if not part of the new API response for simplicity

      setScreenState("result");
      
      queryClient.invalidateQueries({ queryKey: ['/api/gif/searches'] });
      // queryClient.invalidateQueries({ queryKey: ['/api/gif/popular'] }); // If you have a popular endpoint
    },
    onError: (error: Error) => {
      console.error("Error generating GIF:", error);
      setScreenState("error");
      toast({
        title: "Error Generating GIF",
        description: error.message || "Failed to generate GIF. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Handle generation progress (simplified as server does all the work)
  useEffect(() => {
    if (screenState === "generating") {
      const messages = [
        "Contacting AI provider...",
        "Generating image frames...",
        "Encoding GIF on server...",
        "Almost ready...",
      ];
      let messageIndex = 0;
      setProgress(10); // Initial progress
      setStatusMessage(messages[0]);

      const interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + Math.floor(Math.random() * 10) + 5;
          if (newProgress >= 95 && generateGifMutation.isPending) { // Cap at 95% while pending
            return 95;
          }
          if (!generateGifMutation.isPending) { // If mutation finished, jump to 100
            clearInterval(interval);
            return 100;
          }
          return newProgress;
        });
        
        messageIndex = Math.min(Math.floor(progress / (100 / messages.length)), messages.length - 1);
        setStatusMessage(messages[messageIndex]);

      }, 800); // Slower interval as server-side can take time

      return () => clearInterval(interval);
    }
  }, [screenState, generateGifMutation.isPending, progress]);


  // Handle search submission
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
    setProgress(0); // Reset progress
    setCurrentGeneratedGifUrl(null); // Reset previous results
    setCurrentThumbnailUrl(null);
    
    generateGifMutation.mutate({
      query: searchQuery,
      provider: selectedProvider
    });
  };

  // Handle send button click
  const handleSendGif = () => {
    if (currentGeneratedGifUrl) {
      onGifSelect(currentGeneratedGifUrl); // Send the data URL of the GIF
    } else {
        toast({
            title: "No GIF Ready",
            description: "A GIF needs to be generated before it can be sent.",
            variant: "warning"
        });
    }
  };

  // Handle regenerate button click
  const handleRegenerateGif = () => {
    setScreenState("generating");
    setProgress(0);
    setCurrentGeneratedGifUrl(null);
    setCurrentThumbnailUrl(null);
    // setAnimationFrames([]); // Removed
    // setClientGifReady(false); // Removed
    
    generateGifMutation.mutate({
      query: searchQuery, // Uses existing searchQuery
      provider: selectedProvider
    });
  };

  // Removed: handleCreateAnimatedGif function

  // Handle variation selection (assuming variations are still single images/dataURLs)
  const handleVariationSelect = (index: number) => {
    if (variations[index]) {
      setSelectedVariation(index);
      setCurrentGeneratedGifUrl(variations[index]); // Assuming variations are full data URLs
      setCurrentThumbnailUrl(variations[index]); // Or a specific thumbnail for variation if API provides it
    }
  };

  // Handle try again from error
  const handleTryAgain = () => {
    setScreenState("search");
    setSearchQuery(""); // Optionally clear search query
  };

  const handleSelectRecentGif = (item: GifSearchResponseSchema) => {
    setSearchQuery(item.query);
    setCurrentGeneratedGifUrl(item.gifUrl);
    setCurrentThumbnailUrl(item.thumbnailUrl); // Use thumbnail from recent search
    // setAnimationFrames([]); // Removed
    // setClientGifReady(true); // Removed, GIF is always "ready" from server
    setScreenState("result");
  };

  // Search with enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !generateGifMutation.isPending) {
      handleGenerateGif();
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-20">
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-xl shadow-lg slide-up max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-neutral-dark">GIF Wizard</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <span className="material-icons">close</span>
          </Button>
        </div>
        
        {/* Search Input */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="relative">
            <Input
              type="text"
              id="gifSearchInput"
              placeholder="Type what you want in your GIF..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-neutral-light rounded-full px-4 py-2 pl-10 pr-24 outline-none"
              disabled={screenState === "generating"}
            />
            <span className="material-icons absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-medium">search</span>
            <Button
              onClick={handleGenerateGif}
              disabled={screenState === "generating" || !searchQuery.trim()}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-primary text-white px-3 py-1 rounded-full text-sm font-medium"
            >
              {screenState === "generating" ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
        
        {/* AI Provider Selection Tabs (remains the same) */}
        <Tabs defaultValue="auto" onValueChange={(value) => setSelectedProvider(value as AiProvider)}>
          <TabsList className="px-2 border-b border-gray-200 flex overflow-x-auto hide-scrollbar w-full justify-start h-12 bg-transparent">
            <TabsTrigger value="auto" className="px-4 py-2 text-sm font-medium flex-shrink-0 data-[state=active]:border-b-2 border-primary data-[state=active]:shadow-none rounded-none">
              Auto (Best Result)
            </TabsTrigger>
            <TabsTrigger value="openai" className="px-4 py-2 text-sm font-medium flex-shrink-0 data-[state=active]:border-b-2 border-primary data-[state=active]:shadow-none rounded-none">
              OpenAI DALL-E
            </TabsTrigger>
            <TabsTrigger value="google" className="px-4 py-2 text-sm font-medium flex-shrink-0 data-[state=active]:border-b-2 border-primary data-[state=active]:shadow-none rounded-none">
              Google Imagen
            </TabsTrigger>
            <TabsTrigger value="anthropic" className="px-4 py-2 text-sm font-medium flex-shrink-0 data-[state=active]:border-b-2 border-primary data-[state=active]:shadow-none rounded-none">
              Anthropic Claude
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        {/* Search History Container */}
        {screenState === "search" && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-neutral-medium mb-3">RECENT SEARCHES</h3>
              <Button variant="ghost" size="sm" onClick={onOpenSettings} className="text-sm text-primary">
                Settings
              </Button>
            </div>
            
            {isLoadingRecent ? (
              <p>Loading recent searches...</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {recentSearches && recentSearches.map((item) => (
                  <GifThumbnail
                    key={item.id}
                    query={item.query}
                    gifUrl={item.thumbnailUrl || item.gifUrl} // Use server thumbnail
                    onClick={() => handleSelectRecentGif(item)}
                  />
                ))}
              </div>
            )}
            
            <h3 className="text-sm font-medium text-neutral-medium mt-6 mb-3">POPULAR AMONG USERS</h3>
            {isLoadingPopular ? (
              <p>Loading popular searches...</p>
            ) : (
               <div className="grid grid-cols-2 gap-3">
                {popularSearches && popularSearches.map((item) => (
                  <GifThumbnail
                    key={item.id}
                    query={item.query}
                    gifUrl={item.thumbnailUrl || item.gifUrl} // Use server thumbnail
                    onClick={() => handleSelectRecentGif(item)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* GIF Generation in Progress (Simplified) */}
        {screenState === "generating" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md">
              <div className="aspect-video bg-neutral-light rounded-lg overflow-hidden mb-4 relative">
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="loading-spinner w-10 h-10 border-4 border-neutral-light rounded-full"></div>
                  <p className="text-neutral-dark mt-4 text-sm font-medium">Creating your GIF on the server...</p>
                  <p className="text-neutral-medium text-xs mt-1">{statusMessage}</p>
                </div>
              </div>
              <div className="w-full bg-neutral-light rounded-full h-2 mb-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between text-xs text-neutral-medium">
                <span>{statusMessage}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Button 
                variant="destructive"
                className="w-full py-2 mt-4"
                onClick={() => {
                  generateGifMutation.reset(); // Reset mutation state if needed
                  setScreenState("search");
                }}
              >
                Cancel Generation
              </Button>
            </div>
          </div>
        )}
        
        {/* Generated GIF Result (Uses currentGeneratedGifUrl and currentThumbnailUrl) */}
        {screenState === "result" && currentGeneratedGifUrl && (
          <div className="flex-1 flex flex-col items-center p-6 overflow-y-auto">
            <div className="w-full max-w-md">
              <div className="bg-neutral-light rounded-lg overflow-hidden mb-4 relative">
                <img 
                  src={currentGeneratedGifUrl} // Display the GIF from server data URL
                  alt={searchQuery}
                  className="w-full object-contain max-h-[350px] mx-auto"
                />
                {/* Removed Play Button and Loading Overlay for client-side animation */}
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  variant="default"
                  className="flex-1 py-2 flex items-center justify-center"
                  onClick={handleSendGif}
                >
                  <span className="material-icons mr-1 text-sm">send</span>
                  Send
                </Button>
                <Button 
                  variant="outline"
                  className="flex-1 py-2 flex items-center justify-center"
                  onClick={handleRegenerateGif}
                >
                  <span className="material-icons mr-1 text-sm">refresh</span>
                  Regenerate
                </Button>
                <Button 
                  variant="outline"
                  className="flex-none w-12 py-2 flex items-center justify-center"
                  onClick={() => {
                    navigator.clipboard.writeText(currentGeneratedGifUrl).then(() => {
                       toast({ title: "Copied!", description: "GIF Data URL copied to clipboard."});
                    }, () => {
                       toast({ title: "Copy Failed", description: "Could not copy GIF URL.", variant: "destructive"});
                    });
                  }}
                >
                  <span className="material-icons text-sm">share</span>
                </Button>
              </div>
              
              <div className="mt-4">
                <h3 className="text-sm font-medium text-neutral-dark mb-1">Model Info</h3>
                <div className="flex flex-wrap gap-2 items-center text-xs text-neutral-medium">
                  <span className="px-2 py-1 bg-neutral-light rounded-full">
                    Generated with {selectedProvider === "auto" ? "Server Default" : 
                      selectedProvider === "openai" ? "OpenAI" : 
                      selectedProvider === "google" ? "Google" : "Anthropic"}
                  </span>
                  {/* Removed animation indicator as server handles it */}
                   <span className="px-2 py-1 bg-neutral-light rounded-full flex items-center">
                      <span className="material-icons text-xs mr-1">gif</span>
                      Animated GIF
                    </span>
                  {/* <span className="text-neutral-medium text-xs">5 seconds</span> */}
                </div>
              </div>
              
              {/* Variations display (if variations data is still provided and makes sense) */}
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
                          src={variationUrl} // Assuming variationUrl is a data URL
                          alt={`Variation ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Error State (remains mostly the same) */}
        {screenState === "error" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md text-center">
              <span className="material-icons text-destructive text-5xl">error_outline</span>
              <h3 className="text-neutral-dark font-medium mt-4">Something went wrong</h3>
              <p className="text-neutral-medium text-sm mt-2">
                We couldn't generate your GIF. Please try again or use different wording.
              </p>
              <Button 
                variant="default"
                className="mt-6 px-6 py-2"
                onClick={handleTryAgain}
              >
                Try Again
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
