import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GifThumbnail from "@/components/GifThumbnail";
import { queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useGifCreator } from "@/hooks/use-gif-creator";
import { useAuth } from "@/contexts/AuthContext"; // Import useAuth

type AiProvider = "auto" | "openai" | "google" | "anthropic";
type ScreenState = "search" | "generating" | "result" | "error";

interface GifWizardProps {
  onClose: () => void;
  onGifSelect: (gifUrl: string) => void;
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
  const [currentGeneratedGif, setCurrentGeneratedGif] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null); // First frame preview
  const [variations, setVariations] = useState<string[]>([]);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [animationFrames, setAnimationFrames] = useState<string[]>([]);
  const [isGeneratingClientGif, setIsGeneratingClientGif] = useState(false); // Flag for generating GIF
  const [clientGifReady, setClientGifReady] = useState(false); // Flag for when GIF is ready
  const { toast } = useToast();
  
  const { userSettings, isLoadingSettings, user } = useAuth(); // Get userSettings and user from AuthContext
  
  const { createGif, isCreating, progress: gifCreationProgress } = useGifCreator();

  // Fetch recent searches - ensure this uses apiRequest if it needs auth
  const { 
    data: recentSearchesData, 
    isLoading: isLoadingRecent, 
    isError: isErrorRecent,
    error: recentError 
  } = useQuery({
    queryKey: ['recentSearches', user?.id], // User-specific if endpoint supports it
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/gif/recent'); // This endpoint is now authenticated
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to fetch recent searches' }));
        throw new Error(errorData.message);
      }
      return res.json();
    },
    enabled: !!user, // Only fetch if user is authenticated
  });
  const recentSearches = recentSearchesData?.items;


  // Fetch popular searches (public)
  const { 
    data: popularSearchesData, 
    isLoading: isLoadingPopular,
    isError: isErrorPopular,
    error: popularError
  } = useQuery({
    queryKey: ['popularSearches'],
    queryFn: async () => {
      const res = await fetch('/api/gif/popular'); // Public endpoint
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to fetch popular searches' }));
        throw new Error(errorData.message);
      }
      return res.json();
    }
  });
  const popularSearches = popularSearchesData?.items;


  // Generate GIF mutation
  const generateGifMutation = useMutation({
    mutationFn: async (data: { query: string, provider: AiProvider }) => {
      const res = await apiRequest('POST', '/api/gif/generate', data); // Requires auth
      return res.json();
    },
    onSuccess: async (data) => {
      if (data.animationFrames && data.animationFrames.length > 1) {
        setAnimationFrames(data.animationFrames);
        setPreviewImage(data.animationFrames[0]);
        setCurrentGeneratedGif(data.animationFrames[0]);
        setClientGifReady(false); 
      } else {
        setCurrentGeneratedGif(data.gifUrl);
        setPreviewImage(data.gifUrl);
        setClientGifReady(true); 
      }
      
      setVariations(data.variations || []);
      setScreenState("result");
      
      queryClient.invalidateQueries({ queryKey: ['recentSearches'] });
      queryClient.invalidateQueries({ queryKey: ['popularSearches'] });
    },
    onError: (error) => {
      console.error("Error generating GIF:", error);
      setScreenState("error");
      toast({
        title: "Error",
        description: "Failed to generate GIF. Please try again.",
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    if (screenState === "generating") {
      const statusMessages = [
        "Analyzing your request...",
        "Generating images with AI...",
        "Creating animation frames...",
        "Optimizing GIF quality...",
        "Finalizing your GIF..."
      ];
      
      if (!isCreating) {
        let currentProgress = 0;
        let messageIndex = 0;
        const interval = setInterval(() => {
          currentProgress += Math.random() * 15;
          if (currentProgress >= 100) {
            currentProgress = 100;
            clearInterval(interval);
          }
          setProgress(currentProgress);
          if (currentProgress > messageIndex * 20 && messageIndex < statusMessages.length) {
            setStatusMessage(statusMessages[messageIndex]);
            messageIndex++;
          }
        }, 300);
        return () => clearInterval(interval);
      }
    }
  }, [screenState, isCreating]);
  
  useEffect(() => {
    if (isCreating) {
      setProgress(gifCreationProgress);
      if (gifCreationProgress < 50) {
        setStatusMessage("Processing animation frames...");
      } else if (gifCreationProgress < 90) {
        setStatusMessage("Creating animated GIF...");
      } else {
        setStatusMessage("Finalizing your GIF...");
      }
    }
  }, [isCreating, gifCreationProgress]);

  const handleGenerateGif = () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Error",
        description: "Please enter a search query",
        variant: "destructive",
      });
      return;
    }
    setScreenState("generating");
    setProgress(0);
    generateGifMutation.mutate({
      query: searchQuery,
      provider: selectedProvider
    });
  };

  const handleSendGif = () => {
    if (isGeneratingClientGif) {
      toast({
        title: "GIF Still Processing",
        description: "Please wait for the animation to finish generating.",
      });
      return;
    }
    if (currentGeneratedGif) {
      onGifSelect(currentGeneratedGif);
    }
  };

  const handleRegenerateGif = () => {
    if (isGeneratingClientGif) return;
    setScreenState("generating");
    setProgress(0);
    setCurrentGeneratedGif(null);
    setPreviewImage(null);
    setAnimationFrames([]);
    setClientGifReady(false);
    generateGifMutation.mutate({
      query: searchQuery,
      provider: selectedProvider
    });
  };

  const handleCreateAnimatedGif = async () => {
    if (animationFrames.length <= 1 || isLoadingSettings) return; // Don't proceed if settings are still loading
    
    try {
      setIsGeneratingClientGif(true);
      setStatusMessage("Creating animated GIF...");
      
      const { gifDuration, gifQuality } = userSettings; // Get from AuthContext

      const qualityMap = { low: 30, medium: 20, high: 10 }; // Example mapping for gif.js quality
      const numericQuality = qualityMap[gifQuality as keyof typeof qualityMap] || 10;


      const gifDataUrl = await createGif(animationFrames, {
        width: 400, // Consider making this configurable or dynamic
        height: 400, // Consider making this configurable or dynamic
        // delay is calculated in useGifCreator based on gifDuration & frame count
        gifDuration: gifDuration, // Pass duration in seconds
        quality: numericQuality,    // Pass numeric quality
        repeat: 0    
      });
      
      setCurrentGeneratedGif(gifDataUrl);
      setClientGifReady(true);
      setIsGeneratingClientGif(false);
      
      toast({
        title: "GIF Animation Ready",
        description: "Your animated GIF has been created!",
      });
    } catch (error) {
      console.error("Error creating animated GIF:", error);
      setIsGeneratingClientGif(false);
      toast({
        title: "Animation Error",
        description: "Failed to create animated GIF. Using still image instead.",
        variant: "destructive",
      });
    }
  };

  const handleVariationSelect = (index: number) => {
    setSelectedVariation(index);
    setCurrentGeneratedGif(variations[index]);
    setPreviewImage(variations[index]);
    setClientGifReady(true); 
    setAnimationFrames([]); // Variations are single images, clear animation frames
  };

  const handleTryAgain = () => {
    setScreenState("search");
  };

  const handleSelectRecentGif = (query: string, gifUrl: string) => {
    setSearchQuery(query);
    setCurrentGeneratedGif(gifUrl);
    setPreviewImage(gifUrl);
    setClientGifReady(true); 
    setAnimationFrames([]); 
    setScreenState("result");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
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
              Create
            </Button>
          </div>
        </div>
        
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
        
        {screenState === "search" && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-neutral-medium mb-3">RECENT SEARCHES</h3>
              <Button variant="ghost" size="sm" onClick={onOpenSettings} className="text-sm text-primary">
                Settings
              </Button>
            </div>
            
            {isLoadingRecent && (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-lg overflow-hidden shadow-sm bg-white border border-gray-200">
                    <div className="aspect-video bg-neutral-light overflow-hidden placeholder-shimmer"></div>
                    <div className="p-2"><div className="h-3 w-2/3 bg-neutral-light placeholder-shimmer rounded"></div></div>
                  </div>
                ))}
              </div>
            )}
            {isErrorRecent && (
              <p className="col-span-2 text-sm text-destructive">
                Error loading recent searches: {recentError?.message || "Unknown error"}
              </p>
            )}
            {!isLoadingRecent && !isErrorRecent && (
              <div className="grid grid-cols-2 gap-3">
                {recentSearches && Array.isArray(recentSearches) && recentSearches.length > 0 ? 
                  recentSearches.map((item: any) => (
                    <GifThumbnail
                      key={item.id}
                      query={item.query}
                      gifUrl={item.gifUrl}
                      onClick={() => handleSelectRecentGif(item.query, item.gifUrl)}
                    />
                  )) : 
                  !user ? <p className="col-span-2 text-sm text-neutral-medium">Login to see your recent searches.</p> :
                  <p className="col-span-2 text-sm text-neutral-medium">No recent searches found.</p>}
              </div>
            )}
            
            <h3 className="text-sm font-medium text-neutral-medium mt-6 mb-3">POPULAR AMONG USERS</h3>
            
            {isLoadingPopular && (
               <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-lg overflow-hidden shadow-sm bg-white border border-gray-200">
                    <div className="aspect-video bg-neutral-light overflow-hidden placeholder-shimmer"></div>
                    <div className="p-2"><div className="h-3 w-2/3 bg-neutral-light placeholder-shimmer rounded"></div></div>
                  </div>
                ))}
              </div>
            )}
            {isErrorPopular && (
              <p className="col-span-2 text-sm text-destructive">
                Error loading popular searches: {popularError?.message || "Unknown error"}
              </p>
            )}
            {!isLoadingPopular && !isErrorPopular && (
              <div className="grid grid-cols-2 gap-3">
                {popularSearches && Array.isArray(popularSearches) && popularSearches.length > 0 ? 
                  popularSearches.map((item: any) => (
                    <GifThumbnail
                      key={item.id}
                      query={item.query}
                      gifUrl={item.gifUrl}
                      onClick={() => handleSelectRecentGif(item.query, item.gifUrl)}
                    />
                  )) : <p className="col-span-2 text-sm text-neutral-medium">No popular searches found.</p>}
              </div>
            )}
          </div>
        )}
        
        {screenState === "generating" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md">
              <div className="aspect-video bg-neutral-light rounded-lg overflow-hidden mb-4 relative">
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="loading-spinner w-10 h-10 border-4 border-neutral-light rounded-full"></div>
                  <p className="text-neutral-dark mt-4 text-sm font-medium">Creating your GIF...</p>
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
                onClick={() => setScreenState("search")}
              >
                Cancel Generation
              </Button>
            </div>
          </div>
        )}
        
        {screenState === "result" && currentGeneratedGif && (
          <div className="flex-1 flex flex-col items-center p-6 overflow-y-auto">
            <div className="w-full max-w-md">
              <div className="bg-neutral-light rounded-lg overflow-hidden mb-4 relative">
                <img 
                  src={currentGeneratedGif} 
                  alt={searchQuery}
                  className="w-full object-contain max-h-[350px] mx-auto"
                />
                {animationFrames.length > 1 && !clientGifReady && !isGeneratingClientGif && (
                  <div 
                    className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 cursor-pointer" 
                    onClick={handleCreateAnimatedGif}
                  >
                    <div className="flex flex-col items-center text-white">
                      <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                        <span className="material-icons text-3xl">play_arrow</span>
                      </div>
                      <p className="mt-2 font-medium">Create Animated GIF</p>
                    </div>
                  </div>
                )}
                {isGeneratingClientGif && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60">
                    <div className="loading-spinner w-10 h-10 border-4 border-neutral-light rounded-full"></div>
                    <p className="text-white mt-4 font-medium">Creating Animation...</p>
                    <div className="w-48 bg-neutral-light rounded-full h-2 mt-4">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${gifCreationProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-white text-sm mt-2">{Math.round(gifCreationProgress)}%</p>
                  </div>
                )}
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
                {animationFrames.length > 1 && !clientGifReady && !isGeneratingClientGif && (
                  <Button 
                    variant="outline"
                    className="flex-1 py-2 flex items-center justify-center"
                    onClick={handleCreateAnimatedGif}
                    disabled={isLoadingSettings} // Disable if settings are still loading
                  >
                    <span className="material-icons mr-1 text-sm">gif</span>
                    Animate
                  </Button>
                )}
                <Button 
                  variant="outline"
                  className="flex-1 py-2 flex items-center justify-center"
                  onClick={handleRegenerateGif}
                  disabled={isGeneratingClientGif}
                >
                  <span className="material-icons mr-1 text-sm">refresh</span>
                  Regenerate
                </Button>
                <Button 
                  variant="outline"
                  className="flex-none w-12 py-2 flex items-center justify-center"
                  onClick={() => {
                    navigator.clipboard.writeText(currentGeneratedGif)
                      .then(() => toast({ title: "Copied!", description: "GIF link copied to clipboard." }))
                      .catch(() => toast({ title: "Copy Failed", description: "Could not copy link.", variant: "destructive" }));
                  }}
                  disabled={isGeneratingClientGif}
                >
                  <span className="material-icons text-sm">share</span>
                </Button>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-medium text-neutral-dark mb-1">Model Info</h3>
                <div className="flex flex-wrap gap-2 items-center text-xs text-neutral-medium">
                  <span className="px-2 py-1 bg-neutral-light rounded-full">
                    Generated with {selectedProvider === "auto" ? "Best AI" : 
                      selectedProvider === "openai" ? "OpenAI DALL-E" : 
                      selectedProvider === "google" ? "Google Imagen" : "Anthropic Claude"}
                  </span>
                  {animationFrames.length > 1 && (
                    <span className="px-2 py-1 bg-neutral-light rounded-full flex items-center">
                      <span className="material-icons text-xs mr-1">
                        {clientGifReady ? "motion_photos_on" : "motion_photos_paused"}
                      </span>
                      {clientGifReady ? "Animated GIF" : `${animationFrames.length} Animation Frames`}
                    </span>
                  )}
                  {/* Display actual duration from settings if available */}
                  <span className="px-2 py-1 bg-neutral-light rounded-full">
                    {userSettings.gifDuration} seconds
                  </span>
                </div>
              </div>
              {variations.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-neutral-dark mb-1">Variations</h3>
                  <div className="flex space-x-2 overflow-x-auto pb-2 hide-scrollbar">
                    {variations.map((variation, index) => (
                      <div 
                        key={index}
                        className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer ${
                          selectedVariation === index ? 'border-2 border-primary' : ''
                        }`}
                        onClick={() => handleVariationSelect(index)}
                      >
                        <img 
                          src={variation} 
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
