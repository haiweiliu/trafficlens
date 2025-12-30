/**
 * Domain normalization and validation utilities
 */

export interface NormalizedDomain {
  domain: string;
  original: string;
}

/**
 * Normalizes a domain string by:
 * - Removing protocols (http://, https://)
 * - Removing paths and query strings
 * - Converting to lowercase
 * - Keeping www. prefix (for matching purposes)
 * - Trimming whitespace
 */
export function normalizeDomain(domain: string): string {
  let normalized = domain.trim().toLowerCase();
  
  // Remove protocol
  normalized = normalized.replace(/^https?:\/\//, '');
  
  // Remove paths, query strings, and fragments
  normalized = normalized.split('/')[0];
  normalized = normalized.split('?')[0];
  normalized = normalized.split('#')[0];
  
  // Remove trailing dots
  normalized = normalized.replace(/\.+$/, '');
  
  // Keep www. for now - we'll handle matching flexibly
  return normalized;
}

/**
 * Gets domain variations (with and without www.)
 */
export function getDomainVariations(domain: string): string[] {
  const normalized = normalizeDomain(domain);
  const withoutWww = normalized.replace(/^www\./, '');
  const withWww = `www.${withoutWww}`;
  
  // Return both variations, avoiding duplicates
  if (normalized === withWww) {
    return [normalized];
  }
  return [normalized, withoutWww, withWww].filter((v, i, arr) => arr.indexOf(v) === i);
}

/**
 * Validates if a string is a valid domain format
 */
export function isValidDomain(domain: string): boolean {
  if (!domain || domain.length === 0) return false;
  
  // Basic domain validation regex
  const domainRegex = /^([a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  return domainRegex.test(domain);
}

/**
 * Parses input text and extracts domains
 * Supports:
 * - One per line
 * - Comma-separated
 * - Mixed formats
 */
export function parseDomains(input: string): string[] {
  if (!input || input.trim().length === 0) return [];
  
  // Split by newlines and commas
  const domains = input
    .split(/[\n,]+/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  return domains;
}

/**
 * Normalizes and deduplicates a list of domains
 */
export function normalizeDomains(domains: string[]): NormalizedDomain[] {
  const seen = new Set<string>();
  const result: NormalizedDomain[] = [];
  
  for (const domain of domains) {
    const normalized = normalizeDomain(domain);
    
    // Skip empty or invalid domains
    if (!normalized || !isValidDomain(normalized)) {
      continue;
    }
    
    // Deduplicate
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push({
        domain: normalized,
        original: domain.trim(),
      });
    }
  }
  
  return result;
}

/**
 * Chunks an array into batches of specified size
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

