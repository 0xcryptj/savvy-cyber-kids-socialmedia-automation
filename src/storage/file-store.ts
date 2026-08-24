import { chmod, mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import path from "path";
import { BlobStore, DocumentKey, DocumentStore, secretDocuments } from "./types";

/** Overridable so tests get their own directory instead of the real one. */
export function storageRoot(): string {
  return process.env.STORAGE_DIR || path.join(process.cwd(), "storage");
}

const documentFiles: Record<DocumentKey, string> = {
  workspace: "workspace.json",
  "postiz-exports": "postiz-exports.json",
  "postiz-settings": "postiz-settings.json",
  "source-cache": "source-cache.json",
  credentials: "credentials.json",
  settings: "settings.json",
  pipeline: "pipeline.json"
};

/**
 * One promise chain per key. Node runs our JavaScript on a single thread, so
 * queueing here is enough to stop two overlapping requests from reading the
 * same document and writing back over each other.
 */
const chains = new Map<string, Promise<unknown>>();

function serialize<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = chains.get(key) ?? Promise.resolve();
  const next = previous.then(work, work);
  // Keep the chain going but never let a rejection poison the next caller.
  chains.set(key, next.catch(() => undefined));
  return next;
}

export class FileDocumentStore implements DocumentStore {
  private file(key: DocumentKey): string {
    return path.join(storageRoot(), documentFiles[key]);
  }

  async read<T>(key: DocumentKey): Promise<T | undefined> {
    try {
      return JSON.parse(await readFile(this.file(key), "utf8")) as T;
    } catch {
      return undefined;
    }
  }

  async write<T>(key: DocumentKey, value: T): Promise<void> {
    return serialize(`doc:${key}`, () => this.writeNow(key, value));
  }

  private async writeNow<T>(key: DocumentKey, value: T): Promise<void> {
    const target = this.file(key);
    const secret = secretDocuments.has(key);
    await mkdir(path.dirname(target), { recursive: true, ...(secret ? { mode: 0o700 } : {}) });
    // Write and move, so a crash mid-write cannot leave a truncated document
    // where the workspace or the export ledger used to be.
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(value, null, 2), secret ? { mode: 0o600 } : undefined);
    await rename(temporary, target);
    if (secret) await chmod(target, 0o600);
  }

  async update<T>(key: DocumentKey, mutate: (current: T | undefined) => T): Promise<T> {
    return serialize(`doc:${key}`, async () => {
      const next = mutate(await this.read<T>(key));
      await this.writeNow(key, next);
      return next;
    });
  }
}

/** Rejects anything that could climb out of the storage directory. */
function safeBlobKey(key: string): string {
  const normalized = key.replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((part) => !/^[A-Za-z0-9._-]+$/.test(part) || part === "." || part === "..")) {
    throw new Error(`Invalid blob key: ${key}`);
  }
  return normalized;
}

export class FileBlobStore implements BlobStore {
  private file(key: string): string {
    return path.join(storageRoot(), safeBlobKey(key));
  }

  async read(key: string): Promise<Uint8Array<ArrayBuffer> | undefined> {
    try {
      // A Node Buffer is a view onto a pooled allocation, which does not type
      // as a plain ArrayBuffer. Copy so callers get something they can pass to
      // fetch as a body.
      return Uint8Array.from(await readFile(this.file(key)));
    } catch {
      return undefined;
    }
  }

  async write(key: string, bytes: Uint8Array): Promise<void> {
    const target = this.file(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }

  async delete(key: string): Promise<void> {
    await rm(this.file(key), { force: true });
  }
}
