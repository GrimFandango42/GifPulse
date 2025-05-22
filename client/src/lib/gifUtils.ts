/**
 * Utility functions for GIF handling
 */

// Convert blob URL to base64 for sending to server (if needed for other features)
export async function blobUrlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Remove the data URL prefix
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Get file size in human-readable format
export function getFileSize(base64OrDataUrl: string): string {
  let actualBase64 = base64OrDataUrl;
  if (base64OrDataUrl.startsWith('data:')) {
    actualBase64 = base64OrDataUrl.split(',')[1];
  }
  const sizeInBytes = Math.ceil((actualBase64.length * 3) / 4); // Base64 string length to bytes
  
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  } else if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

// Check if GIF file size is within limits
export function isGifSizeValid(base64OrDataUrl: string, maxSizeMB: number = 5): boolean {
  let actualBase64 = base64OrDataUrl;
  if (base64OrDataUrl.startsWith('data:')) {
    actualBase64 = base64OrDataUrl.split(',')[1];
  }
  const sizeInBytes = Math.ceil((actualBase64.length * 3) / 4);
  const sizeInMB = sizeInBytes / (1024 * 1024);
  
  return sizeInMB <= maxSizeMB;
}

// Removed generateThumbnail function as server now provides thumbnail URLs

// Format provider names for display
export function formatProviderName(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'OpenAI DALL-E';
    case 'google':
      return 'Google Imagen';
    case 'anthropic':
      return 'Anthropic Claude';
    case 'auto':
    default:
      return 'Auto (Best Result)';
  }
}
