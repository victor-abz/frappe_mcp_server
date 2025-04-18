import { FrappeApp } from "frappe-js-sdk";

// Initialize Frappe JS SDK
console.error(`Initializing Frappe JS SDK with URL: ${process.env.FRAPPE_URL || "http://localhost:8000"}`);
console.error(`Using API Key: ${process.env.FRAPPE_API_KEY ? process.env.FRAPPE_API_KEY.substring(0, 4) + '...' : 'not set'}`);
console.error(`Using API Secret: ${process.env.FRAPPE_API_SECRET ? '***' : 'not set'}`);
console.error(`Username available: ${process.env.FRAPPE_USERNAME ? 'yes' : 'no'}`);
console.error(`Password available: ${process.env.FRAPPE_PASSWORD ? 'yes' : 'no'}`);

// Token-based authentication (primary method)
export const frappe = new FrappeApp(process.env.FRAPPE_URL || "http://localhost:8000", {
  useToken: true,
  token: () => `${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`,
  type: "token", // For API key/secret pairs
});

// Password-based authentication (fallback method)
export const frappePassword = new FrappeApp(process.env.FRAPPE_URL || "http://localhost:8000");

// Add request interceptor to include X-Press-Team header and log requests
frappe.axios.interceptors.request.use(config => {
  config.headers = config.headers || {};
  console.error(`Making request to: ${config.url}`);
  console.error(`Request method: ${config.method}`);
  console.error(`Request headers:`, JSON.stringify(config.headers, null, 2));
  if (config.data) {
    console.error(`Request data:`, JSON.stringify(config.data, null, 2));
  }
  return config;
});

// Add response interceptor to log responses
frappe.axios.interceptors.response.use(
  response => {
    console.error(`Response status: ${response.status}`);
    console.error(`Response headers:`, JSON.stringify(response.headers, null, 2));
    console.error(`Response data:`, JSON.stringify(response.data, null, 2));
    return response;
  },
  error => {
    console.error(`Response error:`, error);
    if (error.response) {
      console.error(`Error status: ${error.response.status}`);
      console.error(`Error data:`, JSON.stringify(error.response.data, null, 2));
    }
    return Promise.reject(error);
  }
);

// Add the same interceptors to the password-based client
frappePassword.axios.interceptors.request.use(config => {
  config.headers = config.headers || {};
  console.error(`[Password Auth] Making request to: ${config.url}`);
  console.error(`[Password Auth] Request method: ${config.method}`);
  console.error(`[Password Auth] Request headers:`, JSON.stringify(config.headers, null, 2));
  if (config.data) {
    console.error(`[Password Auth] Request data:`, JSON.stringify(config.data, null, 2));
  }
  return config;
});

frappePassword.axios.interceptors.response.use(
  response => {
    console.error(`[Password Auth] Response status: ${response.status}`);
    console.error(`[Password Auth] Response headers:`, JSON.stringify(response.headers, null, 2));
    console.error(`[Password Auth] Response data:`, JSON.stringify(response.data, null, 2));
    return response;
  },
  error => {
    console.error(`[Password Auth] Response error:`, error);
    if (error.response) {
      console.error(`[Password Auth] Error status: ${error.response.status}`);
      console.error(`[Password Auth] Error data:`, JSON.stringify(error.response.data, null, 2));
    }
    return Promise.reject(error);
  }
);