// Proof photos must survive a bad signal. A courier in the middle of a
// kampung road should be able to take the delivery photos, press send, and
// trust that they arrive — with the ORIGINAL capture time and GPS — as soon
// as the phone has signal again.
//
// Every submission is written to IndexedDB BEFORE the first network call, so
// closing the tab or losing power mid-upload never loses a photo. Network
// failures leave the item queued for retry; a real rejection from the server
// (bad GPS, wrong code, step not available...) moves it to "failed" so the
// courier sees why instead of it retrying forever.

const STAGE_REACHED = {
  pickup: ["picked_up", "in_transit", "delivered"],
  transit: ["in_transit", "delivered"],
  deliver: ["delivered"],
  fail: ["failed"],
};

/**
 * @param {{
 *   store: { get: (key: string) => Promise<any>, set: (key: string, value: any) => Promise<void>, del: (key: string) => Promise<void>, keys: () => Promise<string[]> },
 *   upload: (blob: Blob) => Promise<string>,
 *   send: (stage: string, orderId: string, body: object) => Promise<any>,
 *   fetchJob: (orderId: string) => Promise<any>,
 *   now?: () => number,
 *   makeId?: () => string,
 * }} deps
 */
export function createProofQueue({ store, upload, send, fetchJob, now = Date.now, makeId = () => crypto.randomUUID() }) {
  const listeners = new Set();
  let flushing = null;

  const notify = () => listeners.forEach((listener) => listener());

  async function list() {
    const ids = await store.keys();
    const items = await Promise.all(ids.map((id) => store.get(id)));
    return items.filter(Boolean).sort((a, b) => a.createdAt - b.createdAt);
  }

  // Did this step already go through even though we never saw the answer?
  async function alreadyApplied(item) {
    try {
      const job = await fetchJob(item.orderId);
      return STAGE_REACHED[item.stage]?.includes(job?.assignment?.status) ?? false;
    } catch {
      return false;
    }
  }

  async function attempt(item) {
    try {
      // Each photo is uploaded once; if a later step fails, the next retry
      // reuses the urls instead of uploading (and storing) duplicates.
      for (const photo of item.photos) {
        if (!photo.url) {
          photo.url = await upload(photo.blob);
          await store.set(item.id, item);
        }
      }
      const result = await send(item.stage, item.orderId, { ...item.body, photos: item.photos.map((photo) => photo.url) });
      await store.del(item.id);
      return { status: "sent", result };
    } catch (error) {
      item.attempts += 1;
      item.lastError = error.message || "Upload failed";
      if (error.isNetworkError || error.status === 408 || error.status === 429 || error.status >= 500) {
        await store.set(item.id, item);
        return { status: "queued", error };
      }
      if (error.status === 409 && item.attempts > 1 && (await alreadyApplied(item))) {
        await store.del(item.id);
        return { status: "sent", result: null };
      }
      item.state = "failed";
      await store.set(item.id, item);
      return { status: "rejected", error };
    }
  }

  return {
    /**
     * Saves the submission, then tries to send it right away.
     * Resolves with { status: "sent" | "queued" | "rejected", ... } — it only
     * throws if the item could not even be saved.
     */
    async submit({ orderId, orderNumber, stage, photos, body }) {
      const item = {
        id: makeId(),
        orderId,
        orderNumber,
        stage,
        photos: photos.map((blob) => ({ blob, url: null })),
        body,
        createdAt: now(),
        attempts: 0,
        lastError: null,
        state: "pending",
      };
      await store.set(item.id, item);
      notify();
      const outcome = await attempt(item);
      notify();
      return { ...outcome, id: item.id };
    },

    /** Retries every pending item, oldest first. Safe to call from several places at once. */
    flush() {
      if (flushing) return flushing;
      flushing = (async () => {
        let sent = 0;
        for (const item of await list()) {
          if (item.state !== "pending") continue;
          const outcome = await attempt(item);
          if (outcome.status === "sent") sent += 1;
          // Still offline: no point trying the rest right now.
          if (outcome.status === "queued" && outcome.error?.isNetworkError) break;
        }
        return sent;
      })().finally(() => {
        flushing = null;
        notify();
      });
      return flushing;
    },

    list,
    /** Pending + failed counts for the badge in the app header. */
    async counts() {
      const items = await list();
      return {
        pending: items.filter((item) => item.state === "pending").length,
        failed: items.filter((item) => item.state === "failed").length,
      };
    },
    /** Drops a failed item once the courier has seen it. */
    async dismiss(id) {
      await store.del(id);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
