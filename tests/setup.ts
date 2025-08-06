/**
 * Vitest Setup File
 * 
 * Modern TypeScript ESM setup for real Frappe testing
 * NO MOCKS, NO STUBS, NO FALLBACKS - real data only
 */

// Ensure required environment variables are set for real testing
if (!process.env.FRAPPE_URL) {
  process.env.FRAPPE_URL = 'https://epinomy.com';
}

if (!process.env.FRAPPE_API_KEY) {
  process.env.FRAPPE_API_KEY = 'ff09790d111aeab';
}

if (!process.env.FRAPPE_API_SECRET) {
  process.env.FRAPPE_API_SECRET = 'd3bc10957fd898f';
}

console.log('🧪 Vitest setup complete - using REAL Frappe instance at:', process.env.FRAPPE_URL);