/**
 * @file Utility functions for various client-side operations.
 * Includes functions for file conversion, size calculation, and display formatting.
 */

/**
 * Converts a Blob URL (e.g., from `URL.createObjectURL`) to a Base64 encoded string.
 * The "data:image/png;base64," part is removed from the beginning of the string.
 * @param {string} url - The Blob URL to convert.
 * @returns {Promise<string>} A Promise that resolves with the Base64 encoded string (without data URL prefix).
 * @throws Will reject if fetching the blob or reading it as data URL fails.
 */
export async function blobUrlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch blob from URL: ${url}. Status: ${response.statusText}`);
  }
  const blob = await response.blob();
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const parts = reader.result.split(',');
        if (parts.length > 1) {
          resolve(parts[1]); // Return only the Base64 part
        } else {
          // Handle cases where the result might not be a typical data URL (e.g., empty file)
          resolve(''); // Or reject(new Error('Invalid data URL format'));
        }
      } else {
        reject(new Error('Failed to read blob as string.'));
      }
    };
    reader.onerror = (error) => reject(new Error(`FileReader error: ${error}`));
    reader.readAsDataURL(blob);
  });
}

/**
 * Calculates the file size from a Base64 string or a data URL and returns it in a human-readable format (B, KB, MB).
 * @param {string} base64OrDataUrl - The Base64 encoded string or a full data URL.
 * @returns {string} The file size in a human-readable string format.
 */
export function getFileSize(base64OrDataUrl: string): string {
  let actualBase64 = base64OrDataUrl;
  if (base64OrDataUrl.startsWith('data:')) {
    const parts = base64OrDataUrl.split(',');
    if (parts.length > 1) {
      actualBase64 = parts[1];
    } else {
      actualBase64 = ''; // Handle potentially malformed data URL
    }
  }
  // Estimate byte size from Base64 string length
  // Each Base64 character represents 6 bits. 4 chars = 24 bits = 3 bytes.
  // Padding characters ('=') do not contribute to data size.
  const paddingChars = (actualBase64.endsWith('==') ? 2 : actualBase64.endsWith('=') ? 1 : 0);
  const sizeInBytes = (actualBase64.length * 0.75) - paddingChars;
  
  if (sizeInBytes < 0) return "0 B"; // Should not happen with correct Base64
  if (sizeInBytes < 1024) {
    return `${sizeInBytes.toFixed(0)} B`;
  } else if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

/**
 * Checks if the estimated file size of a Base64 string or data URL is within a specified maximum size.
 * @param {string} base64OrDataUrl - The Base64 encoded string or a full data URL.
 * @param {number} [maxSizeMB=5] - The maximum allowed file size in megabytes. Defaults to 5MB.
 * @returns {boolean} True if the file size is valid (within limits), false otherwise.
 */
export function isGifSizeValid(base64OrDataUrl: string, maxSizeMB: number = 5): boolean {
  let actualBase64 = base64OrDataUrl;
  if (base64OrDataUrl.startsWith('data:')) {
     const parts = base64OrDataUrl.split(',');
    if (parts.length > 1) {
      actualBase64 = parts[1];
    } else {
      actualBase64 = '';
    }
  }
  const paddingChars = (actualBase64.endsWith('==') ? 2 : actualBase64.endsWith('=') ? 1 : 0);
  const sizeInBytes = (actualBase64.length * 0.75) - paddingChars;
  const sizeInMB = sizeInBytes / (1024 * 1024);
  
  return sizeInMB <= maxSizeMB;
}

/**
 * Formats AI provider names for display in the UI.
 * @param {string} provider - The provider key (e.g., 'openai', 'google', 'auto').
 * @returns {string} A user-friendly display name for the provider.
 */
export function formatProviderName(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'OpenAI DALL-E';
    case 'google':
      return 'Google Imagen';
    case 'anthropic': // Although image generation is mocked, the provider name is still used.
      return 'Anthropic Claude';
    case 'auto':
    default:
      return 'Auto (Best Result)'; // Or "Server Default" if more accurate
  }
}

// The `generateThumbnail` function was removed as thumbnails are now provided by the server.
