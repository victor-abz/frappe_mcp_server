// Re-export everything from the new modular files
export { FrappeApiError, handleApiError } from './errors.js';
export { frappe, frappePassword } from './api-client.js';
export { authenticateWithPassword, checkFrappeApiHealth } from './auth.js';
export {
  getDocument,
  getDocumentWithAuth,
  createDocument,
  createDocumentWithAuth,
  updateDocument,
  updateDocumentWithAuth,
  deleteDocument,
  deleteDocumentWithAuth,
  listDocuments,
  listDocumentsWithAuth,
  callMethod
} from './document-api.js';
export {
  getDocTypeSchema,
  getFieldOptions,
  getAllDocTypes,
  getAllModules
} from './schema-api.js';