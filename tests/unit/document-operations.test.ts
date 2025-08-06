/**
 * Real Document Operations Tests
 * 
 * Tests document CRUD operations with REAL Frappe API
 * NO MOCKS - tests against actual Frappe documents
 */

import { describe, test, expect } from 'vitest';
import { handleDocumentToolCall } from '../../src/document-operations.js';

describe('Document Operations (Real Frappe API)', () => {
  test('should list User documents from real Frappe', async () => {
    const request = {
      params: {
        arguments: {
          doctype: 'User',
          fields: ['name', 'email', 'first_name'],
          limit: 5,
        }
      }
    };

    const result = await handleDocumentToolCall(request);
    
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(5);
    
    // Check structure of returned documents
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('name');
    }
  });

  test('should get document count from real Frappe', async () => {
    const request = {
      params: {
        arguments: {
          doctype: 'User',
        }
      }
    };

    const result = await handleDocumentToolCall(request);

    expect(result).toBeDefined();
    expect(typeof result.count).toBe('number');
    expect(result.count).toBeGreaterThan(0);
  });
});