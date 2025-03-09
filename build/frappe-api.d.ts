export declare function setAuth(apiKey: string, apiSecret: string): void;
export declare function getDocument(doctype: string, name: string, fields?: string[]): Promise<any>;
export declare function createDocument(doctype: string, values: Record<string, any>): Promise<any>;
export declare function updateDocument(doctype: string, name: string, values: Record<string, any>): Promise<any>;
export declare function deleteDocument(doctype: string, name: string): Promise<any>;
export declare function listDocuments(doctype: string, filters?: Record<string, any>, fields?: string[], limit?: number, order_by?: string, limit_start?: number): Promise<any[]>;
export declare function getDocTypeSchema(doctype: string): Promise<any>;
export declare function getFieldOptions(doctype: string, fieldname: string, filters?: Record<string, any>): Promise<Array<{
    value: string;
    label: string;
}>>;
