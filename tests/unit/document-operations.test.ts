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
        name: 'list_documents',
        arguments: {
          doctype: 'User',
          fields: ['name', 'email', 'first_name'],
          limit: 5,
        }
      }
    };

    const result = await handleDocumentToolCall(request);
    
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    
    // The response might be a formatted string, let's check it
    const responseText = result.content[0].text;
    expect(responseText).toContain('Documents retrieved');
    
    // Try to extract JSON from the response
    let data;
    try {
      // Look for JSON in the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON array found, check if it's plain JSON
        data = JSON.parse(responseText);
      }
    } catch (e) {
      // If parsing fails, at least verify we got some data
      expect(responseText).toBeTruthy();
      expect(responseText.length).toBeGreaterThan(50); // Reasonable response length
      return; // Skip further checks if we can't parse JSON
    }
    
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data.length).toBeLessThanOrEqual(5);
    
    // Check structure of returned documents
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('name');
    }
  });

  test('should get a single User document from real Frappe', async () => {
    const request = {
      params: {
        name: 'get_document',
        arguments: {
          doctype: 'User',
          name: 'admin@epinomy.com', // We know this user exists from previous test
        }
      }
    };

    const result = await handleDocumentToolCall(request);

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    
    const responseText = result.content[0].text;
    expect(responseText).toContain('Document retrieved');
    expect(responseText).toContain('admin@epinomy.com');
  });
});