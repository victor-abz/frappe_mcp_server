import { frappePassword } from './api-client.js';

// Authentication state tracking
let isAuthenticated = false;
let authenticationInProgress = false;
let lastAuthAttempt = 0;
const AUTH_TIMEOUT = 1000 * 60 * 30; // 30 minutes

/**
 * Authenticate with username and password
 */
export async function authenticateWithPassword(): Promise<boolean> {
  // Don't authenticate if already in progress
  if (authenticationInProgress) {
    console.error("Authentication already in progress, waiting...");
    // Wait for current authentication to complete
    while (authenticationInProgress) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return isAuthenticated;
  }

  // Check if we've authenticated recently
  const now = Date.now();
  if (isAuthenticated && (now - lastAuthAttempt < AUTH_TIMEOUT)) {
    console.error("Using existing authentication session");
    return true;
  }

  // Start authentication
  authenticationInProgress = true;

  try {
    if (!process.env.FRAPPE_USERNAME || !process.env.FRAPPE_PASSWORD) {
      console.error("Username or password not provided in environment variables");
      isAuthenticated = false;
      return false;
    }

    console.error(`Attempting to login with username: ${process.env.FRAPPE_USERNAME}`);

    const response = await frappePassword.auth().loginWithUsernamePassword({
      username: process.env.FRAPPE_USERNAME,
      password: process.env.FRAPPE_PASSWORD
    });

    console.error("Login response:", JSON.stringify(response, null, 2));
    isAuthenticated = true;
    lastAuthAttempt = now;
    return true;
  } catch (error) {
    console.error("Error authenticating with username/password:", error);
    isAuthenticated = false;
    return false;
  } finally {
    authenticationInProgress = false;
  }
}

/**
 * Check the health of the Frappe API connection
 * @returns Health status information
 */
export async function checkFrappeApiHealth(): Promise<{
  healthy: boolean;
  tokenAuth: boolean;
  passwordAuth: boolean;
  message: string;
}> {
  const result = {
    healthy: false,
    tokenAuth: false,
    passwordAuth: false,
    message: ""
  };

  try {
    // Try token authentication
    try {
      const tokenResponse = await frappe.db().getDocList("DocType", { limit: 1 });
      result.tokenAuth = true;
    } catch (tokenError) {
      console.error("Token authentication health check failed:", tokenError);
      result.tokenAuth = false;
    }

    // Try password authentication
    try {
      const authSuccess = await authenticateWithPassword();
      if (authSuccess) {
        const passwordResponse = await frappePassword.db().getDocList("DocType", { limit: 1 });
        result.passwordAuth = true;
      }
    } catch (passwordError) {
      console.error("Password authentication health check failed:", passwordError);
      result.passwordAuth = false;
    }

    // Set overall health status
    result.healthy = result.tokenAuth || result.passwordAuth;
    result.message = result.healthy
      ? `API connection healthy. Token auth: ${result.tokenAuth}, Password auth: ${result.passwordAuth}`
      : "API connection unhealthy. Both authentication methods failed.";

    return result;
  } catch (error) {
    result.message = `Health check failed: ${(error as Error).message}`;
    return result;
  }
}

// Import frappe here to avoid circular dependency
import { frappe } from './api-client.js';