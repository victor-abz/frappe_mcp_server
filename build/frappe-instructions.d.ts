/**
 * This file contains detailed instructions and examples for using the Frappe API
 * through the MCP server. It provides guidance on common operations and best practices.
 */
/**
 * Common Frappe DocTypes
 *
 * These are some of the standard DocTypes in Frappe that you might want to interact with:
 *
 * - User: User accounts in the system
 * - Role: User roles for permission management
 * - DocType: Metadata about document types
 * - DocField: Field definitions for DocTypes
 * - DocPerm: Permission rules for DocTypes
 * - Custom Field: Custom fields added to DocTypes
 * - Custom Script: Client-side scripts for DocTypes
 * - Server Script: Server-side scripts for automation
 * - Workflow: Workflow definitions
 * - Workflow State: States in a workflow
 * - Workflow Action: Actions that transition between workflow states
 */
export declare const COMMON_DOCTYPES: {
    SYSTEM: string[];
    CORE: string[];
};
/**
 * Frappe API Usage Instructions
 *
 * This object contains detailed instructions for common Frappe operations.
 * Each instruction includes a description, example usage, and tips.
 */
export declare const FRAPPE_INSTRUCTIONS: {
    DOCUMENT_OPERATIONS: {
        CREATE: {
            description: string;
            usage: string;
        };
        GET: {
            description: string;
            usage: string;
        };
        UPDATE: {
            description: string;
            usage: string;
        };
        DELETE: {
            description: string;
            usage: string;
        };
        LIST: {
            description: string;
            usage: string;
        };
    };
    SCHEMA_OPERATIONS: {
        GET_DOCTYPE_SCHEMA: {
            description: string;
            usage: string;
        };
        GET_FIELD_OPTIONS: {
            description: string;
            usage: string;
        };
        FIND_DOCTYPE: {
            description: string;
            usage: string;
        };
    };
    ADVANCED_OPERATIONS: {
        WORKING_WITH_CHILD_TABLES: {
            description: string;
            usage: string;
        };
        HANDLING_FILE_ATTACHMENTS: {
            description: string;
            usage: string;
        };
        WORKING_WITH_WORKFLOWS: {
            description: string;
            usage: string;
        };
    };
    BEST_PRACTICES: {
        HANDLING_ERRORS: {
            description: string;
            usage: string;
        };
        EFFICIENT_QUERYING: {
            description: string;
            usage: string;
        };
        NAMING_CONVENTIONS: {
            description: string;
            usage: string;
        };
    };
};
/**
 * Helper function to get instructions for a specific operation
 */
export declare function getInstructions(category: string, operation: string): string;
/**
 * Helper function to get a list of common DocTypes
 */
export declare function getCommonDocTypes(category: string): string[];
