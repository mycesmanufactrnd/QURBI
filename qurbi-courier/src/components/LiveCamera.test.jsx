import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The stamp/canvas step is covered by its own tests; here the camera screen's
// behaviour is what matters, so capture is replaced by a fast fake.
vi.mock("@/lib/capture", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    captureStampedPhoto: vi.fn(async ({ fix }) => ({
      blob: new Blob(["jpeg"], { type: "image/jpeg" }),
      previewUrl: "blob:test/preview",
      meta: { latitude: fix.latitude, longitude: fix.longitude, accuracy: Math.round(fix.accuracy), capturedAt: "2026-10-11T08:00:00.000Z" },
    })),
  };
});

import LiveCamera from "@/components/LiveCamera";
import { captureStampedPhoto } from "@/lib/capture";

let geoSuccess;
let geoError;
const stopTrack = vi.fn();

function fix(accuracy, timestamp = Date.now()) {
  return { coords: { latitude: 3.0449, longitude: 101.4455, accuracy }, timestamp };
}

function installDevices({ getUserMedia } = {}) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: getUserMedia ?? vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] })) },
  });
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      watchPosition: vi.fn((success, error) => { geoSuccess = success; geoError = error; return 7; }),
      clearWatch: vi.fn(),
      getCurrentPosition: vi.fn((success) => success(fix(9))),
    },
  });
  // jsdom does not implement media playback.
  HTMLMediaElement.prototype.play = vi.fn(async () => {});
}

const renderCamera = (props = {}) => render(
  <LiveCamera orderNumber="QRB-1" stageLabel="Pickup" photoLabel="Livestock at the farm" step={{ current: 1, total: 2 }} onUse={vi.fn()} onClose={vi.fn()} {...props} />,
);

// jsdom never plays video; this is the browser telling us the first frame has dimensions.
const videoStarts = () => fireEvent.loadedMetadata(document.querySelector("video"));

describe("LiveCamera", () => {
  beforeEach(() => { installDevices(); stopTrack.mockClear(); vi.mocked(captureStampedPhoto).mockClear(); });
  afterEach(() => vi.restoreAllMocks());

  it("has no gallery or file picker — a photo can only come from the live camera", async () => {
    const { container } = renderCamera();
    await screen.findByRole("button", { name: /take photo/i });
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getByText(/cannot pick one from your gallery/i)).toBeInTheDocument();
  });

  it("keeps the shutter disabled until the video has its first frame, even with a perfect GPS fix", async () => {
    renderCamera();
    const shutter = await screen.findByRole("button", { name: /take photo/i });
    act(() => geoSuccess(fix(8)));
    expect(shutter).toBeDisabled();
    expect(screen.getByText(/starting camera/i)).toBeInTheDocument();
    videoStarts();
    await waitFor(() => expect(shutter).toBeEnabled());
  });

  it("keeps the shutter disabled until the GPS is accurate enough, and explains why", async () => {
    renderCamera();
    const shutter = await screen.findByRole("button", { name: /take photo/i });
    videoStarts();
    expect(shutter).toBeDisabled();
    expect(screen.getByText(/finding your location/i)).toBeInTheDocument();

    act(() => geoSuccess(fix(250)));
    expect(shutter).toBeDisabled();
    expect(screen.getByText(/location too weak \(±250 m\)/i)).toBeInTheDocument();

    act(() => geoSuccess(fix(18)));
    await waitFor(() => expect(shutter).toBeEnabled());
    expect(screen.getByText(/location locked \(±18 m\)/i)).toBeInTheDocument();
  });

  it("asks for a fresh GPS reading at capture time when the last one is old (a stationary phone stops updating)", async () => {
    const user = userEvent.setup();
    renderCamera();
    const shutter = await screen.findByRole("button", { name: /take photo/i });
    videoStarts();
    act(() => geoSuccess(fix(20, Date.now() - 60_000)));
    // An old but accurate reading must not lock the shutter...
    await waitFor(() => expect(shutter).toBeEnabled());
    await user.click(shutter);
    // ...the reading used for the photo is a new one.
    expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalled();
    expect(captureStampedPhoto).toHaveBeenCalledWith(expect.objectContaining({ fix: expect.objectContaining({ accuracy: 9 }) }));
  });

  it("falls back to a recent reading when a new one cannot be obtained (some devices serve one GPS request at a time)", async () => {
    const user = userEvent.setup();
    renderCamera();
    const shutter = await screen.findByRole("button", { name: /take photo/i });
    videoStarts();
    act(() => geoSuccess(fix(20, Date.now() - 30_000)));
    navigator.geolocation.getCurrentPosition.mockImplementationOnce((_ok, fail) => fail({ code: 3 }));
    await waitFor(() => expect(shutter).toBeEnabled());
    await user.click(shutter);
    expect(captureStampedPhoto).toHaveBeenCalledWith(expect.objectContaining({ fix: expect.objectContaining({ accuracy: 20 }) }));
  });

  it("does not take the photo when the only reading is too old and no new one can be obtained", async () => {
    const user = userEvent.setup();
    renderCamera();
    const shutter = await screen.findByRole("button", { name: /take photo/i });
    videoStarts();
    act(() => geoSuccess(fix(20, Date.now() - 5 * 60_000)));
    navigator.geolocation.getCurrentPosition.mockImplementationOnce((_ok, fail) => fail({ code: 2 }));
    await waitFor(() => expect(shutter).toBeEnabled());
    await user.click(shutter);
    expect(captureStampedPhoto).not.toHaveBeenCalled();
    expect(await screen.findByText(/location is not available right now/i)).toBeInTheDocument();
  });

  it("always shows a blocked-location problem instead of falling back", async () => {
    const user = userEvent.setup();
    renderCamera();
    const shutter = await screen.findByRole("button", { name: /take photo/i });
    videoStarts();
    act(() => geoSuccess(fix(20, Date.now() - 30_000)));
    navigator.geolocation.getCurrentPosition.mockImplementationOnce((_ok, fail) => fail({ code: 1 }));
    await waitFor(() => expect(shutter).toBeEnabled());
    await user.click(shutter);
    expect(captureStampedPhoto).not.toHaveBeenCalled();
    expect(await screen.findByText(/location access was blocked/i)).toBeInTheDocument();
  });

  it("captures with the live fix, shows the result, and hands it over only on 'Use this photo'", async () => {
    const user = userEvent.setup();
    const onUse = vi.fn();
    renderCamera({ onUse });
    const shutter = await screen.findByRole("button", { name: /take photo/i });
    videoStarts();
    act(() => geoSuccess(fix(12)));
    await waitFor(() => expect(shutter).toBeEnabled());

    await user.click(shutter);
    expect(captureStampedPhoto).toHaveBeenCalledWith(expect.objectContaining({
      orderNumber: "QRB-1",
      stageLabel: "Pickup",
      fix: expect.objectContaining({ latitude: 3.0449, longitude: 101.4455, accuracy: 12 }),
    }));
    expect(onUse).not.toHaveBeenCalled();

    await user.click(await screen.findByRole("button", { name: /use this photo/i }));
    expect(onUse).toHaveBeenCalledWith(expect.objectContaining({
      previewUrl: "blob:test/preview",
      meta: expect.objectContaining({ latitude: 3.0449, accuracy: 12 }),
    }));
    expect(stopTrack).toHaveBeenCalled(); // camera released
  });

  it("lets the courier retake without closing the camera", async () => {
    const user = userEvent.setup();
    const onUse = vi.fn();
    renderCamera({ onUse });
    const shutter = await screen.findByRole("button", { name: /take photo/i });
    videoStarts();
    act(() => geoSuccess(fix(12)));
    await waitFor(() => expect(shutter).toBeEnabled());
    await user.click(shutter);
    await user.click(await screen.findByRole("button", { name: /retake/i }));
    expect(await screen.findByRole("button", { name: /take photo/i })).toBeInTheDocument();
    expect(onUse).not.toHaveBeenCalled();
  });

  it("tells the courier how to fix a blocked camera", async () => {
    installDevices({ getUserMedia: vi.fn(async () => { throw Object.assign(new Error("denied"), { name: "NotAllowedError" }); }) });
    renderCamera();
    expect(await screen.findByRole("alert")).toHaveTextContent(/camera access was blocked/i);
  });

  it("reports a missing camera API instead of failing silently", async () => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    renderCamera();
    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot open the camera/i);
  });

  it("tells the courier when location access is blocked", async () => {
    renderCamera();
    await screen.findByRole("button", { name: /take photo/i });
    act(() => geoError({ code: 1 }));
    expect(await screen.findByText(/location access was blocked/i)).toBeInTheDocument();
  });

  it("releases the camera and GPS watch when closed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderCamera({ onClose });
    await user.click(await screen.findByRole("button", { name: /close camera/i }));
    expect(onClose).toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalled();
  });
});
