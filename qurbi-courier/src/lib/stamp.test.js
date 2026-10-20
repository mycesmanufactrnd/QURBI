import { describe, expect, it, vi } from "vitest";
import { buildStampLines, drawStamp, formatCoordinates, formatStampTime, wrapLine } from "@/lib/stamp";

describe("photo stamp", () => {
  it("prints time in Malaysia time whatever the phone's own zone is", () => {
    // 07:42:07 UTC is 3:42:07 pm in Kuala Lumpur.
    expect(formatStampTime(new Date("2026-10-11T07:42:07.000Z"))).toMatch(/11 Oct 2026.*3:42:07\s?pm/i);
  });

  it("formats hemispheres and accuracy", () => {
    expect(formatCoordinates(3.0449, 101.4455, 12.4)).toBe("3.044900° N, 101.445500° E (±12 m)");
    expect(formatCoordinates(-33.8688, -151.2093)).toBe("33.868800° S, 151.209300° W");
  });

  it("builds the lines in order and only adds what it has", () => {
    const base = { capturedAt: new Date("2026-10-11T07:42:07.000Z"), latitude: 3.0449, longitude: 101.4455, accuracy: 10 };
    const lines = buildStampLines({ ...base, orderNumber: "QRB-1", stageLabel: "Delivery", address: "Jalan Ladang, Klang" });
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe("Order #QRB-1 · Delivery");
    expect(lines[3]).toBe("Jalan Ladang, Klang");
    expect(buildStampLines(base)).toHaveLength(2);
  });

  it("wraps long addresses to the available width", () => {
    const ctx = { measureText: (text) => ({ width: text.length * 10 }) };
    expect(wrapLine(ctx, "aaa bbb ccc ddd", 70)).toEqual(["aaa bbb", "ccc ddd"]);
    expect(wrapLine(ctx, "short", 500)).toEqual(["short"]);
  });

  it("draws a band sized to the text along the bottom edge, scaled to the photo", () => {
    const ctx = {
      save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(),
      measureText: (text) => ({ width: text.length * 8 }),
    };
    const { bandHeight, rows } = drawStamp(ctx, 1280, 720, ["Order #1 · Pickup", "11 Oct 2026, 3:42:07 pm", "3.044900° N, 101.445500° E (±12 m)"]);
    expect(rows).toHaveLength(3);
    const [x, y, width, height] = ctx.fillRect.mock.calls[0];
    expect([x, width]).toEqual([0, 1280]);
    expect(y + height).toBe(720); // flush with the bottom
    expect(height).toBe(bandHeight);
    expect(ctx.fillText).toHaveBeenCalledTimes(3);

    // A bigger photo gets a proportionally bigger band so the text stays readable.
    const big = { ...ctx, fillRect: vi.fn(), fillText: vi.fn() };
    const bigBand = drawStamp(big, 4000, 3000, ["a", "b", "c"]).bandHeight;
    expect(bigBand).toBeGreaterThan(bandHeight);
  });
});
