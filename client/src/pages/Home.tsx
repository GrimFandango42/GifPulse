import React, { useState } from "react"; // Removed useEffect as not immediately needed
import { useLocation } from "wouter"; // For navigation
import GroupMeIntegration from "@/components/GroupMeIntegration";
// GifWizard and SettingsScreen are now routed components, so direct rendering here might change
// import GifWizard from "@/components/GifWizard";
// import SettingsScreen from "@/components/SettingsScreen";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "../contexts/AuthContext"; // Import useAuth
import { Button } from "@/components/ui/button"; // For potential login/register prompts

export default function Home() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast(); // Keep toast for other notifications

  // State for GroupMeIntegration
  const [selectedGif, setSelectedGif] = useState<string | null>(null);

  // This function is passed to GroupMeIntegration.
  // If user is not logged in, it should ideally prompt to login/register or navigate to wizard.
  const handleGifButtonClick = () => {
    if (user) {
      navigate('/wizard'); // Navigate to the protected GifWizard route
    } else {
      toast({
        title: "Authentication Required",
        description: "Please log in or register to use the GIF Wizard.",
        variant: "default",
        action: <Button onClick={() => navigate('/login')}>Login</Button>
      });
    }
  };

  // handleOpenSettings is now handled by the Header link in App.tsx

  const handleGifSelect = (gifUrl: string) => {
    // This function would be called if GifWizard was a modal.
    // If GifWizard is a separate page, this selection logic might need to live there
    // or be communicated back via a shared state/context if Home needs to know.
    // For now, if GifWizard is a page, it might handle selection and usage itself.
    setSelectedGif(gifUrl);
    toast({
      title: "GIF Selected",
      description: "Your custom GIF has been added to the message (simulated).",
    });
    // If GifWizard is a page, navigation back to Home might be needed,
    // or the GIF is used directly from the wizard page.
  };
  
  const handleGifSent = () => {
    setSelectedGif(null);
  };

  if (authLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading user status...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Welcome to the GIF Wizard!</h1>
        {user ? (
          <p className="text-xl text-muted-foreground">
            You are logged in as <span className="font-semibold text-primary">{user.username}</span>.
          </p>
        ) : (
          <p className="text-xl text-muted-foreground">
            Create and share amazing GIFs. <Link href="/login" className="text-primary hover:underline">Login</Link> or <Link href="/register" className="text-primary hover:underline">Register</Link> to get started!
          </p>
        )}
      </div>

      {/* GroupMeIntegration is the primary feature on the home page */}
      <GroupMeIntegration 
        onGifButtonClick={handleGifButtonClick} 
        selectedGif={selectedGif}
        onGifSent={handleGifSent}
        isAuthenticated={!!user} // Pass auth status to GroupMeIntegration
      />

      {/* 
        GifWizard and SettingsScreen are now primarily routed components.
        If they were still intended to be modals triggered from Home,
        their internal logic would need to check auth status if they perform sensitive operations.
        However, since they are protected routes, direct rendering here as modals is less likely.
      */}
      
      {/* Example: If user is not authenticated, show a more prominent CTA */}
      {!user && (
        <div className="mt-12 p-6 bg-muted rounded-lg text-center">
          <h2 className="text-2xl font-semibold mb-3">Ready to Create Magic?</h2>
          <p className="mb-4 text-muted-foreground">
            Log in or register to unlock the full power of the GIF Wizard and save your preferences.
          </p>
          <div className="space-x-4">
            <Button size="lg" onClick={() => navigate('/login')}>Login</Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/register')}>Register</Button>
          </div>
        </div>
      )}
    </div>
  );
}
