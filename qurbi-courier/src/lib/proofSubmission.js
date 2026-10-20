import { createStore, del, get, keys, set } from "idb-keyval";
import { jobsApi, uploadApi } from "@/api/apiClient";
import { createProofQueue } from "@/lib/proofQueue";

const idbStore = createStore("qurbi-courier", "proof-queue");

// The app-wide queue, backed by the phone's IndexedDB.
export const proofQueue = createProofQueue({
  store: {
    get: (key) => get(key, idbStore),
    set: (key, value) => set(key, value, idbStore),
    del: (key) => del(key, idbStore),
    keys: () => keys(idbStore),
  },
  upload: (blob) => uploadApi.upload(blob, "proof.jpg"),
  send: (stage, orderId, body) => jobsApi[stage](orderId, body),
  fetchJob: (orderId) => jobsApi.detail(orderId),
});

// Retry whenever the phone regains signal or the courier returns to the app.
export function startProofQueueSync() {
  const flush = () => { proofQueue.flush().catch(() => {}); };
  window.addEventListener("online", flush);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) flush(); });
  flush();
}
