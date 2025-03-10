import { AxiosError } from "axios";
/**
 * Error class for Frappe API errors
 */
export declare class FrappeApiError extends Error {
    statusCode?: number;
    endpoint?: string;
    details?: any;
    constructor(message: string, statusCode?: number, endpoint?: string, details?: any);
    static fromAxiosError(error: AxiosError, operation: string): FrappeApiError;
}
export declare function setAuth(apiKey: string, apiSecret: string): void;
export declare function getDocument(doctype: string, name: string, fields?: string[]): Promise<any>;
export declare function createDocument(doctype: string, values: Record<string, any>): Promise<any>;
export declare function updateDocument(doctype: string, name: string, values: Record<string, any>): Promise<any>;
export declare function deleteDocument(doctype: string, name: string): Promise<any>;
export declare function listDocuments(doctype: string, filters?: Record<string, any>, fields?: string[], limit?: number, order_by?: string, limit_start?: number): Promise<any[]>;
/**
 * Execute a Frappe method call
 * @param method The method name to call
 * @param params The parameters to pass to the method
 * @returns The method response
 */
export declare function callMethod(method: string, params?: Record<string, any>): Promise<any>;
/**
 * Get the schema for a DocType
 * @param doctype The DocType name
 * @returns The DocType schema
 */
export declare function getDocTypeSchema(doctype: string): Promise<any>;
export declare function getFieldOptions(doctype: string, fieldname: string, filters?: Record<string, any>): Promise<Array<{
    value: string;
    label: string;
}>>;
/**
 * Get a list of all DocTypes in the system
 * @returns Array of DocType names
 */
export declare function getAllDocTypes(): Promise<string[]>;
/**
 * Get a list of all modules in the system
 * @returns Array of module names
 */
export declare function getAllModules(): Promise<string[]>;
