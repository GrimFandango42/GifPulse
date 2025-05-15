import { useState } from "react";
import GroupMeIntegration from "@/components/GroupMeIntegration";
import GifWizard from "@/components/GifWizard";
import SettingsScreen from "@/components/SettingsScreen";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [isGifWizardOpen, setIsGifWizardOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGifButtonClick = () => {
    setIsGifWizardOpen(true);
  };

  const handleCloseGifWizard = () => {
    setIsGifWizardOpen(false);
  };

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
    setIsGifWizardOpen(false);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
  };

  const handleGifSelect = (gifUrl: string) => {
    setSelectedGif(gifUrl);
    setIsGifWizardOpen(false);
    
    toast({
      title: "GIF Selected",
      description: "Your custom GIF has been added to the message",
    });
  };
  
  // Clear selected GIF after sending
  const handleGifSent = () => {
    setSelectedGif(null);
  };

  return (
    <div className="relative min-h-screen">
      <GroupMeIntegration 
        onGifButtonClick={handleGifButtonClick} 
        selectedGif={selectedGif}
        onGifSent={handleGifSent}
      />
      
      {isGifWizardOpen && (
        <GifWizard 
          onClose={handleCloseGifWizard} 
          onGifSelect={handleGifSelect}
          onOpenSettings={handleOpenSettings}
        />
      )}
      
      {isSettingsOpen && (
        <SettingsScreen 
          onClose={handleCloseSettings} 
        />
      )}
    </div>
  );
}
