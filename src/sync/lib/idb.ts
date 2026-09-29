/** Helpers mínimos sobre IndexedDB (sin Dexie). */

export function openDatabase(
  name: string,
  version: number,
  upgrade: (db: IDBDatabase, oldVersion: number) => void,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version)
    request.onupgradeneeded = (event) => {
      upgrade(request.result, event.oldVersion)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('No se pudo abrir IndexedDB'))
  })
}

export function idbReq<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('Error IndexedDB'))
  })
}

export function idbTxDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Transacción IndexedDB falló'))
    tx.onabort = () => reject(tx.error ?? new Error('Transacción IndexedDB abortada'))
  })
}
