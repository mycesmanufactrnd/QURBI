import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProofQueue } from "@/lib/proofQueue";

function memoryStore() {
  const map = new Map();
  return {
    map,
    get: async (key) => map.get(key),
    set: async (key, value) => { map.set(key, value); },
    del: async (key) => { map.delete(key); },
    keys: async () => [...map.keys()],
  };
}

const networkError = () => Object.assign(new Error("Network Error"), { isNetworkError: true });
const apiError = (status, message) => Object.assign(new Error(message), { status, isNetworkError: false });

function setup(overrides = {}) {
  const store = memoryStore();
  let id = 0;
  const upload = vi.fn(async () => `/uploads/private/${++id}`);
  const send = vi.fn(async () => ({ id: "assignment-1" }));
  const fetchJob = vi.fn(async () => ({ assignment: { status: "accepted" } }));
  const queue = createProofQueue({ store, upload, send, fetchJob, now: () => 1000, makeId: () => `item-${store.map.size + 1}`, ...overrides });
  return { queue, store, upload, send, fetchJob };
}

const submission = (extra = {}) => ({
  orderId: "order-1",
  orderNumber: "QRB-1",
  stage: "transit",
  photos: [new Blob(["a"]), new Blob(["b"])],
  body: { meta: { latitude: 3, longitude: 101, accuracy: 10, capturedAt: "2026-10-11T08:00:00.000Z" } },
  ...extra,
});

describe("proof queue", () => {
  let ctx;
  beforeEach(() => { ctx = setup(); });

  it("uploads every photo, sends the step with the original capture metadata and clears the queue", async () => {
    const outcome = await ctx.queue.submit(submission());
    expect(outcome.status).toBe("sent");
    expect(ctx.upload).toHaveBeenCalledTimes(2);
    expect(ctx.send).toHaveBeenCalledWith("transit", "order-1", {
      meta: { latitude: 3, longitude: 101, accuracy: 10, capturedAt: "2026-10-11T08:00:00.000Z" },
      photos: ["/uploads/private/1", "/uploads/private/2"],
    });
    expect(await ctx.queue.list()).toHaveLength(0);
  });

  it("saves the submission before touching the network", async () => {
    let savedBeforeUpload = false;
    ctx = setup({
      upload: vi.fn(async () => {
        savedBeforeUpload = ctx.store.map.size === 1;
        throw networkError();
      }),
    });
    await ctx.queue.submit(submission());
    expect(savedBeforeUpload).toBe(true);
  });

  it("keeps the item queued when the phone is offline, with the original capturedAt", async () => {
    ctx.upload.mockRejectedValueOnce(networkError());
    const outcome = await ctx.queue.submit(submission());
    expect(outcome.status).toBe("queued");
    const [item] = await ctx.queue.list();
    expect(item.state).toBe("pending");
    expect(item.body.meta.capturedAt).toBe("2026-10-11T08:00:00.000Z");
  });

  it("retries on flush and does not re-upload photos that already uploaded", async () => {
    ctx.send.mockRejectedValueOnce(networkError());
    await ctx.queue.submit(submission());
    expect(ctx.upload).toHaveBeenCalledTimes(2);

    const sent = await ctx.queue.flush();
    expect(sent).toBe(1);
    expect(ctx.upload).toHaveBeenCalledTimes(2); // reused, not uploaded again
    expect(ctx.send).toHaveBeenCalledTimes(2);
    expect(await ctx.queue.list()).toHaveLength(0);
  });

  it("stops flushing as soon as it is still offline", async () => {
    ctx.send.mockRejectedValue(networkError());
    await ctx.queue.submit(submission());
    await ctx.queue.submit(submission({ stage: "pickup" }));
    ctx.send.mockClear();
    await ctx.queue.flush();
    expect(ctx.send).toHaveBeenCalledTimes(1);
  });

  it("marks a server rejection as failed instead of retrying forever, and keeps the reason", async () => {
    ctx.send.mockRejectedValueOnce(apiError(400, "GPS accuracy is too low"));
    const outcome = await ctx.queue.submit(submission());
    expect(outcome.status).toBe("rejected");
    const [item] = await ctx.queue.list();
    expect(item.state).toBe("failed");
    expect(item.lastError).toBe("GPS accuracy is too low");

    ctx.send.mockClear();
    await ctx.queue.flush();
    expect(ctx.send).not.toHaveBeenCalled();
    expect(await ctx.queue.counts()).toEqual({ pending: 0, failed: 1 });
  });

  it("retries after a server error", async () => {
    ctx.send.mockRejectedValueOnce(apiError(503, "Service unavailable"));
    expect((await ctx.queue.submit(submission())).status).toBe("queued");
    expect(await ctx.queue.flush()).toBe(1);
  });

  it("treats a retry that hits 'step not available' as success when the server already applied it", async () => {
    // First attempt reached the server but the answer was lost.
    ctx.send.mockRejectedValueOnce(networkError());
    await ctx.queue.submit(submission());
    // Retry: the server says the step is no longer available because it already ran.
    ctx.send.mockRejectedValueOnce(apiError(409, "This job is in transit, so that step is not available"));
    ctx.fetchJob.mockResolvedValueOnce({ assignment: { status: "in_transit" } });
    expect(await ctx.queue.flush()).toBe(1);
    expect(await ctx.queue.list()).toHaveLength(0);
  });

  it("does NOT swallow a genuine 409 when the step was not applied", async () => {
    ctx.send.mockRejectedValueOnce(networkError());
    await ctx.queue.submit(submission());
    ctx.send.mockRejectedValueOnce(apiError(409, "One of these photos was already submitted"));
    ctx.fetchJob.mockResolvedValueOnce({ assignment: { status: "picked_up" } });
    await ctx.queue.flush();
    const [item] = await ctx.queue.list();
    expect(item.state).toBe("failed");
  });

  it("lets the courier dismiss a failed item and tells subscribers", async () => {
    const listener = vi.fn();
    ctx.queue.subscribe(listener);
    ctx.send.mockRejectedValueOnce(apiError(400, "Wrong code"));
    await ctx.queue.submit(submission({ stage: "deliver" }));
    const [item] = await ctx.queue.list();
    listener.mockClear();
    await ctx.queue.dismiss(item.id);
    expect(listener).toHaveBeenCalled();
    expect(await ctx.queue.list()).toHaveLength(0);
  });

  it("does not run two flushes at once", async () => {
    ctx.send.mockRejectedValueOnce(networkError());
    await ctx.queue.submit(submission());
    ctx.send.mockClear();
    const [a, b] = await Promise.all([ctx.queue.flush(), ctx.queue.flush()]);
    expect(a).toBe(b);
    expect(ctx.send).toHaveBeenCalledTimes(1);
  });
});
