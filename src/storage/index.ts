import { FileBlobStore, FileDocumentStore, VercelBlobDocumentStore, VercelBlobStore } from "./file-store";
import { BlobStore, DocumentStore } from "./types";

export type { DocumentKey, DocumentStore, BlobStore } from "./types";

/**
 * The backends in use. Selection lives here so swapping local files for a
 * database and a blob host is one change in one file, and no caller has to
 * know which one it is talking to.
 */
const productionBlobStorage = process.env.NODE_ENV === "production" && Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
export const documents: DocumentStore = productionBlobStorage ? new VercelBlobDocumentStore() : new FileDocumentStore();
export const blobs: BlobStore = productionBlobStorage ? new VercelBlobStore() : new FileBlobStore();
