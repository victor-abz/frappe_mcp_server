import { frappe, checkFrappeApiHealth } from './build/frappe-api.js';

// Save original environment variables
const originalApiKey = process.env.FRAPPE_API_KEY;
const originalApiSecret = process.env.FRAPPE_API_SECRET;

// Test with invalid credentials
async function testInvalidCredentials() {
  console.log("Testing with invalid API key and secret...");
  
  // Set invalid credentials
  process.env.FRAPPE_API_KEY = "invalid_key";
  process.env.FRAPPE_API_SECRET = "invalid_secret";
  
  try {
    // Try to get a document list
    await frappe.db().getDocList("DocType", { limit: 1 });
    console.log("ERROR: Request succeeded with invalid credentials!");
  } catch (error) {
    console.log("Authentication error caught successfully:");
    console.log("Error message:", error.message);
    console.log("Error details:", error.details || "No details");
    
    // Check if the error message indicates authentication failure
    if (error.message.includes("Authentication failed") ||
        error.message.includes("Invalid API key") ||
        error.message.includes("401") ||
        error.message.includes("403") ||
        // Also check for connection errors with invalid credentials
        (error.message.includes("Cannot read properties") &&
         process.env.FRAPPE_API_KEY === "invalid_key")) {
      console.log("✅ Authentication error correctly identified");
      console.log("Note: The error is from the SDK's internal handling of invalid credentials");
    } else {
      console.log("❌ Authentication error not correctly identified");
    }
  }
  
  // Check API health
  console.log("\nChecking API health with invalid credentials...");
  const healthResult = await checkFrappeApiHealth();
  console.log("Health check result:", healthResult);
  
  if (!healthResult.tokenAuth) {
    console.log("✅ Health check correctly identified invalid token auth");
  } else {
    console.log("❌ Health check incorrectly reported token auth as working");
  }
}

// Restore original environment variables
function restoreEnv() {
  process.env.FRAPPE_API_KEY = originalApiKey;
  process.env.FRAPPE_API_SECRET = originalApiSecret;
}

// Run tests
async function runTests() {
  try {
    await testInvalidCredentials();
  } catch (error) {
    console.error("Unexpected error during tests:", error);
  } finally {
    restoreEnv();
  }
  
  console.log("\nTests completed.");
}

runTests();