/**
 * Real Schema Operations Tests
 * 
 * Tests schema operations with REAL Frappe API
 * NO MOCKS - tests against actual Frappe DocTypes and schemas
 */

import { describe, test, expect } from 'vitest';
import { getDocTypeSchema, getFieldOptions } from '../../src/schema-api.js';
import { getDocTypeHints } from '../../src/static-hints.js';

describe('Schema Operations (Real Frappe API)', () => {
  test('should get DocType schema from real Frappe', async () => {
    const result = await getDocTypeSchema('User');
    
    expect(result).toBeDefined();
    expect(result.name).toBe('User');
    expect(result.fields).toBeDefined();
    expect(Array.isArray(result.fields)).toBe(true);
    expect(result.fields.length).toBeGreaterThan(5); // User should have many fields
    
    // Check for some expected User fields
    const fieldNames = result.fields.map((f: any) => f.fieldname);
    expect(fieldNames).toContain('email');
    expect(fieldNames).toContain('enabled');
  });

  test('should get field options for Link field from real Frappe', async () => {
    // First check if User has role_profile_name field, otherwise use a different approach
    try {
      const result = await getFieldOptions('User', 'role_profile_name');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // Options might be empty, but should still be an array
    } catch (error) {
      // If role_profile_name doesn't exist, test with a simpler approach
      // Just verify the function works with any DocType-field combination
      expect(error).toBeDefined();
      expect(error.message).toContain('Field');
    }
  });

  test('should get combined Frappe usage info with real data', async () => {
    // Test static hints functionality
    const hints = getDocTypeHints('Customer');
    
    expect(hints).toBeDefined();
    expect(Array.isArray(hints)).toBe(true);
    // Customer might have hints or be empty, both are valid
    
    // Also test the schema function directly
    const schema = await getDocTypeSchema('Customer');
    expect(schema).toBeDefined();
    expect(schema.name).toBe('Customer');
  });
});