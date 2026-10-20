import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in camera: one button that "takes" a photo with a distinct metadata
// per call, so the test can tell which photo's reading the step used.
let shot = 0;
vi.mock("@/components/LiveCamera", () => ({
  default: ({ photoLabel, onUse }) => (
    <button
      type="button"
      onClick={() => {
        shot += 1;
        onUse({ blob: new Blob([`p${shot}`]), previewUrl: `blob:test/${shot}`, meta: { latitude: 3, longitude: 101, accuracy: 10 + shot, capturedAt: `2026-10-11T08:0${shot}:00.000Z` } });
      }}
    >
      camera:{photoLabel}
    </button>
  ),
}));

const submit = vi.fn();
const dismiss = vi.fn(async () => {});
vi.mock("@/lib/proofSubmission", () => ({ proofQueue: { submit: (...args) => submit(...args), dismiss: (...args) => dismiss(...args) } }));

import { DeliverFlow, PickupFlow, ProblemFlow, TransitFlow } from "@/components/JobFlows";

const order = { orderId: "order-1", orderNumber: "QRB-1" };
const handlers = () => ({ order, onSent: vi.fn(), onQueued: vi.fn(), onCancel: vi.fn() });

async function takePhoto(user, label) {
  await user.click(screen.getByRole("button", { name: new RegExp(`${label}`, "i") }));
  await user.click(await screen.findByRole("button", { name: new RegExp(`camera:`, "i") }));
}

describe("job flows", () => {
  beforeEach(() => { shot = 0; submit.mockReset(); dismiss.mockClear(); });

  describe("pickup", () => {
    it("blocks the step until all three safety checks are ticked", async () => {
      const user = userEvent.setup();
      render(<PickupFlow {...handlers()} />);
      const send = screen.getByRole("button", { name: /confirm pickup/i });
      expect(send).toBeDisabled();
      expect(screen.getByText(/do not collect the animal until all three/i)).toBeInTheDocument();

      await takePhoto(user, "take photo");
      expect(send).toBeDisabled(); // photo alone is not enough

      for (const name of [/ear tag matches/i, /looks healthy/i, /safely secured/i]) {
        await user.click(screen.getByRole("checkbox", { name }));
      }
      expect(send).toBeEnabled();
    });

    it("sends the photo with the checklist and the photo's own GPS reading", async () => {
      const user = userEvent.setup();
      submit.mockResolvedValue({ status: "sent", id: "q1" });
      const props = handlers();
      render(<PickupFlow {...props} />);
      await takePhoto(user, "take photo");
      for (const name of [/ear tag matches/i, /looks healthy/i, /safely secured/i]) await user.click(screen.getByRole("checkbox", { name }));
      await user.click(screen.getByRole("button", { name: /confirm pickup/i }));

      await waitFor(() => expect(props.onSent).toHaveBeenCalled());
      expect(submit).toHaveBeenCalledWith(expect.objectContaining({
        orderId: "order-1",
        stage: "pickup",
        body: {
          meta: expect.objectContaining({ accuracy: 11, capturedAt: "2026-10-11T08:01:00.000Z" }),
          checklist: { earTagMatches: true, animalHealthy: true, animalSecured: true },
        },
      }));
    });
  });

  describe("transit", () => {
    it("needs one live photo and nothing else", async () => {
      const user = userEvent.setup();
      submit.mockResolvedValue({ status: "sent", id: "q1" });
      const props = handlers();
      render(<TransitFlow {...props} />);
      const send = screen.getByRole("button", { name: /send photo and start/i });
      expect(send).toBeDisabled();
      await takePhoto(user, "take photo");
      await user.click(send);
      await waitFor(() => expect(props.onSent).toHaveBeenCalled());
      expect(submit).toHaveBeenCalledWith(expect.objectContaining({ stage: "transit" }));
    });
  });

  describe("delivery", () => {
    async function takeBoth(user) {
      const buttons = screen.getAllByRole("button", { name: /take photo/i });
      await user.click(buttons[0]);
      await user.click(await screen.findByRole("button", { name: /camera:/i }));
      await user.click(screen.getAllByRole("button", { name: /(take photo|retake)/i })[1]);
      await user.click(await screen.findByRole("button", { name: /camera:/i }));
    }

    it("needs both photos and a 6-digit code, and keeps the code to digits", async () => {
      const user = userEvent.setup();
      render(<DeliverFlow {...handlers()} />);
      const send = screen.getByRole("button", { name: /confirm delivery/i });
      const code = screen.getByLabelText(/6-digit code/i);

      await user.type(code, "12ab34cd56");
      expect(code).toHaveValue("123456");
      expect(send).toBeDisabled(); // no photos yet

      await takeBoth(user);
      expect(send).toBeEnabled();

      await user.clear(code);
      await user.type(code, "123");
      expect(send).toBeDisabled(); // code incomplete
    });

    it("sends both photos with the code, using the LAST photo's reading as the step's metadata", async () => {
      const user = userEvent.setup();
      submit.mockResolvedValue({ status: "sent", id: "q1" });
      const props = handlers();
      render(<DeliverFlow {...props} />);
      await user.type(screen.getByLabelText(/6-digit code/i), "654321");
      await takeBoth(user);
      await user.click(screen.getByRole("button", { name: /confirm delivery/i }));

      await waitFor(() => expect(props.onSent).toHaveBeenCalled());
      const call = submit.mock.calls[0][0];
      expect(call.stage).toBe("deliver");
      expect(call.photos).toHaveLength(2);
      expect(call.body.code).toBe("654321");
      expect(call.body.meta.accuracy).toBe(12); // second photo
    });

    it("explains a rejection, drops the failed queue entry and lets the courier fix it", async () => {
      const user = userEvent.setup();
      submit.mockResolvedValue({ status: "rejected", id: "q9", error: Object.assign(new Error("The delivery code is wrong."), { status: 400 }) });
      const props = handlers();
      render(<DeliverFlow {...props} />);
      await user.type(screen.getByLabelText(/6-digit code/i), "000000");
      await takeBoth(user);
      await user.click(screen.getByRole("button", { name: /confirm delivery/i }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/delivery code is wrong/i);
      expect(dismiss).toHaveBeenCalledWith("q9");
      expect(props.onSent).not.toHaveBeenCalled();
      // Still on the form with the photos kept, so only the code needs fixing.
      expect(screen.getByRole("button", { name: /confirm delivery/i })).toBeEnabled();
    });

    it("shows the saved-on-phone message when there is no signal", async () => {
      const user = userEvent.setup();
      submit.mockResolvedValue({ status: "queued", id: "q2", error: Object.assign(new Error("Network Error"), { isNetworkError: true }) });
      const props = handlers();
      render(<DeliverFlow {...props} />);
      await user.type(screen.getByLabelText(/6-digit code/i), "111222");
      await takeBoth(user);
      await user.click(screen.getByRole("button", { name: /confirm delivery/i }));

      expect(await screen.findByText(/saved on this phone/i)).toBeInTheDocument();
      expect(screen.getByText(/original time and location/i)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /back to the job/i }));
      expect(props.onQueued).toHaveBeenCalled();
    });
  });

  describe("problem report", () => {
    it("needs a category, a description and a photo", async () => {
      const user = userEvent.setup();
      submit.mockResolvedValue({ status: "sent", id: "q1" });
      const props = handlers();
      render(<ProblemFlow {...props} />);
      const send = screen.getByRole("button", { name: /send report/i });
      expect(send).toBeDisabled();

      await user.click(screen.getByRole("radio", { name: /buyer cannot be reached/i }));
      await user.type(screen.getByLabelText(/describe it/i), "Nobody answered the door");
      expect(send).toBeDisabled(); // still no photo
      await takePhoto(user, "take photo");
      expect(send).toBeEnabled();

      await user.click(send);
      await waitFor(() => expect(props.onSent).toHaveBeenCalled());
      expect(submit).toHaveBeenCalledWith(expect.objectContaining({
        stage: "fail",
        body: expect.objectContaining({ category: "buyer_unreachable", reason: "Nobody answered the door" }),
      }));
    });
  });
});
