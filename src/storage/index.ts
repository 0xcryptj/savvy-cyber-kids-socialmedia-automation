import { FileBlobStore, FileDocumentStore } from "./file-store";
import { BlobStore, DocumentStore } from "./types";

export type { DocumentKey, DocumentStore, BlobStore } from "./types";

/**
 * The backends in use. Selection lives here so swapping local files for a
 * database and a blob host is one change in one file, and no caller has to
 * know which one it is talking to.
 */
export const documents: DocumentStore = new FileDocumentStore();
export const blobs: BlobStore = new FileBlobStore();
