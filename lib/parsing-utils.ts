/**
 * Utilities for parsing traffic data from strings
 */

/**
 * Parses a number string with K/M/B suffixes to integer
 * Examples: "12.3K" -> 12300, "4.5M" -> 4500000, "82.28B" -> 82280000000
 */
export function parseNumberWithSuffix(value: string | null | undefined): number | null {
  if (!value) return null;
  
  const cleaned = value.trim().replace(/,/g, '');
  // Match K, M, or B suffix (case insensitive)
  const match = cleaned.match(/^([\d.]+)\s*([KMkmBb]?)$/);
  
  if (!match) {
    // Try to parse as plain number
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : Math.round(num);
  }
  
  const num = parseFloat(match[1]);
  const suffix = match[2].toUpperCase();
  
  if (isNaN(num)) return null;
  
  let multiplier = 1;
  if (suffix === 'K') multiplier = 1000;
  if (suffix === 'M') multiplier = 1000000;
  if (suffix === 'B') multiplier = 1000000000; // Billion
  
  return Math.round(num * multiplier);
}

/**
 * Parses duration string to seconds
 * Supports formats:
 * - "2m 15s" -> 135
 * - "5m" -> 300
 * - "1h 30m" -> 5400
 * - "45s" -> 45
 */
export function parseDurationToSeconds(value: string | null | undefined): number | null {
  if (!value) return null;
  
  const cleaned = value.trim().toLowerCase();
  let totalSeconds = 0;
  
  // Match hours
  const hoursMatch = cleaned.match(/(\d+)\s*h/);
  if (hoursMatch) {
    totalSeconds += parseInt(hoursMatch[1]) * 3600;
  }
  
  // Match minutes
  const minutesMatch = cleaned.match(/(\d+)\s*m/);
  if (minutesMatch) {
    totalSeconds += parseInt(minutesMatch[1]) * 60;
  }
  
  // Match seconds
  const secondsMatch = cleaned.match(/(\d+)\s*s/);
  if (secondsMatch) {
    totalSeconds += parseInt(secondsMatch[1]);
  }
  
  // If no matches, try HH:MM:SS or MM:SS format
  if (totalSeconds === 0) {
    // Try HH:MM:SS format first (e.g., "00:14:24")
    const hhmmssMatch = cleaned.match(/^(\d+):(\d+):(\d+)$/);
    if (hhmmssMatch) {
      totalSeconds = parseInt(hhmmssMatch[1]) * 3600 + 
                     parseInt(hhmmssMatch[2]) * 60 + 
                     parseInt(hhmmssMatch[3]);
    } else {
      // Try MM:SS format (e.g., "14:24")
      const mmssMatch = cleaned.match(/^(\d+):(\d+)$/);
      if (mmssMatch) {
        totalSeconds = parseInt(mmssMatch[1]) * 60 + parseInt(mmssMatch[2]);
      }
    }
  }
  
  return totalSeconds > 0 ? totalSeconds : null;
}

/**
 * Parses percentage string to number
 * Example: "45.2%" -> 45.2
 */
export function parsePercentage(value: string | null | undefined): number | null {
  if (!value) return null;
  
  const cleaned = value.trim().replace('%', '');
  const num = parseFloat(cleaned);
  
  return isNaN(num) ? null : num;
}

