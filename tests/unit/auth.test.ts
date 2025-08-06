/**
 * Real Authentication Tests
 * 
 * Tests authentication with REAL Frappe API credentials
 * NO MOCKS - tests against actual Frappe instance
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { validateApiCredentials, checkFrappeApiHealth } from '../../src/auth.js';

describe('Authentication (Real Frappe API)', () => {
  const frappeUrl = process.env.FRAPPE_URL!;
  const frappeApiKey = process.env.FRAPPE_API_KEY!;
  const frappeApiSecret = process.env.FRAPPE_API_SECRET!;

  beforeAll(() => {
    expect(frappeUrl).toBeTruthy();
    expect(frappeApiKey).toBeTruthy();
    expect(frappeApiSecret).toBeTruthy();
  });

  test('should validate real Frappe API credentials', async () => {
    const result = validateApiCredentials();
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  test('should check Frappe API health with real instance', async () => {
    const result = await checkFrappeApiHealth();
    expect(result.healthy).toBe(true);
    expect(result.error).toBeNull();
  });
});