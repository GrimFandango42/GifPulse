import { useState } from "react";

interface GifThumbnailProps {
  query: string;
  gifUrl: string;
  onClick: () => void;
}

export default function GifThumbnail({ 
  query, 
  gifUrl, 
  onClick 
}: GifThumbnailProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  const handleImageLoad = () => {
    setIsLoading(false);
  };
  
  return (
    <div 
      className="rounded-lg overflow-hidden shadow-sm bg-white border border-gray-200 material-ripple cursor-pointer"
      onClick={onClick}
    >
      <div className="aspect-video bg-neutral-light overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-neutral-light rounded-full loading-spinner"></div>
          </div>
        )}
        <img 
          src={gifUrl} 
          alt={query}
          className={`w-full h-full object-cover ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          onLoad={handleImageLoad}
        />
      </div>
      <div className="p-2">
        <p className="text-xs text-neutral-dark truncate">{query}</p>
      </div>
    </div>
  );
}
