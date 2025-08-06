/**
 * Jest Setup File
 * 
 * Global setup for all tests - ensures real Frappe credentials are available
 * No mocks, no stubs, no fake data - real testing only
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

// Increase timeout for real API calls
jest.setTimeout(30000);

console.log('🧪 Jest setup complete - using REAL Frappe instance at:', process.env.FRAPPE_URL);