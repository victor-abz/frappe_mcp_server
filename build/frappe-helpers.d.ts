/**
 * Helper functions for interacting with the Frappe API
 * These functions provide additional functionality and better error handling
 */
import { AxiosError } from "axios";
/**
 * Error class for Frappe API errors with improved details
 */
export declare class FrappeApiError extends Error {
    statusCode?: number;
    endpoint?: string;
    details?: any;
    constructor(message: string, statusCode?: number, endpoint?: string, details?: any);
    static fromAxiosError(error: AxiosError, operation: string): FrappeApiError;
}
/**
 * Check if a DocType exists
 * @param doctype The DocType name to check
 * @returns True if the DocType exists, false otherwise
 */
export declare function doesDocTypeExist(doctype: string): Promise<boolean>;
/**
 * Check if a document exists
 * @param doctype The DocType name
 * @param name The document name
 * @returns True if the document exists, false otherwise
 */
export declare function doesDocumentExist(doctype: string, name: string): Promise<boolean>;
/**
 * Find DocTypes matching a search term
 * @param searchTerm The search term to look for in DocType names
 * @param options Additional options for the search
 * @returns Array of matching DocTypes with their details
 */
export declare function findDocTypes(searchTerm: string, options?: {
    module?: string;
    isTable?: boolean;
    isSingle?: boolean;
    isCustom?: boolean;
    limit?: number;
}): Promise<any[]>;
/**
 * Get a list of all modules in the system
 * @returns Array of module names
 */
export declare function getModuleList(): Promise<string[]>;
/**
 * Get a list of DocTypes in a specific module
 * @param module The module name
 * @returns Array of DocTypes in the module
 */
export declare function getDocTypesInModule(module: string): Promise<any[]>;
/**
 * Get a count of documents matching filters
 * @param doctype The DocType name
 * @param filters Filters to apply
 * @returns The count of matching documents
 */
export declare function getDocumentCount(doctype: string, filters?: Record<string, any>): Promise<number>;
/**
 * Get the naming series for a DocType
 * @param doctype The DocType name
 * @returns The naming series information or null if not applicable
 */
export declare function getNamingSeriesInfo(doctype: string): Promise<any>;
/**
 * Format filters for Frappe API
 * This helper converts various filter formats to the format expected by the API
 * @param filters The filters in various formats
 * @returns Properly formatted filters for the API
 */
export declare function formatFilters(filters: any): any;
/**
 * Get field metadata for a specific field in a DocType
 * @param doctype The DocType name
 * @param fieldname The field name
 * @returns The field metadata or null if not found
 */
export declare function getFieldMetadata(doctype: string, fieldname: string): Promise<any | null>;
/**
 * Get required fields for a DocType
 * @param doctype The DocType name
 * @returns Array of required field names and their metadata
 */
export declare function getRequiredFields(doctype: string): Promise<any[]>;
