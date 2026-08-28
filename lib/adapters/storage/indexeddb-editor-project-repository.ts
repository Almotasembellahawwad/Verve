import type { EditorProjectRecord, EditorProjectRepositoryPort } from "../../ports/editor-projects";

const DATABASE_NAME = "verve-workspace";
const DATABASE_VERSION = 1;
const STORE_NAME = "projects";

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
  });
}

export class IndexedDbEditorProjectRepository implements EditorProjectRepositoryPort {
  private databasePromise?: Promise<IDBDatabase>;

  private database(): Promise<IDBDatabase> {
    if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is unavailable."));
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
            store.createIndex("updatedAt", "updatedAt");
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not open the Verve workspace."));
      });
    }
    return this.databasePromise;
  }

  private async run<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const transaction = (await this.database()).transaction(STORE_NAME, mode);
    const result = requestResult(operation(transaction.objectStore(STORE_NAME)));
    const [value] = await Promise.all([result, transactionComplete(transaction)]);
    return value;
  }

  async get(id: string): Promise<EditorProjectRecord | undefined> {
    return this.run("readonly", (store) => store.get(id)) as Promise<EditorProjectRecord | undefined>;
  }

  async list(): Promise<EditorProjectRecord[]> {
    const records = await this.run("readonly", (store) => store.getAll()) as EditorProjectRecord[];
    return records.sort((left, right) => right.updatedAt - left.updatedAt);
  }

  async put(record: EditorProjectRecord): Promise<void> {
    await this.run("readwrite", (store) => store.put(record));
  }

  async delete(id: string): Promise<void> {
    await this.run("readwrite", (store) => store.delete(id));
  }
}
