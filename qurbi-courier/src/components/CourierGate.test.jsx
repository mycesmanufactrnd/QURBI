import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

let mockUser = null;
vi.mock("@/lib/AuthContext", () => ({ useAuth: () => ({ user: mockUser, isLoadingAuth: false }) }));

import CourierGate, { StatusScreen, destinationFor } from "@/components/CourierGate";

const courier = (status) => ({ role: "courier", courierProfile: status ? { verificationStatus: status } : undefined });

// The same route shape as App.jsx, trimmed down.
function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/verify" element={<StatusScreen allow={["unverified", "rejected"]}><p>verify screen</p></StatusScreen>} />
        <Route path="/pending" element={<StatusScreen allow={["pending"]}><p>pending screen</p></StatusScreen>} />
        <Route path="/rejected" element={<StatusScreen allow={["rejected"]}><p>rejected screen</p></StatusScreen>} />
        <Route path="/suspended" element={<StatusScreen allow={["suspended"]}><p>suspended screen</p></StatusScreen>} />
        <Route element={<CourierGate />}>
          <Route path="/" element={<p>courier home</p>} />
          <Route path="/jobs" element={<p>jobs screen</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("courier gate", () => {
  it("knows where every state belongs (approved has no redirect)", () => {
    expect(destinationFor("approved")).toBeNull();
    expect(destinationFor("pending")).toBe("/pending");
    expect(destinationFor("rejected")).toBe("/rejected");
    expect(destinationFor("suspended")).toBe("/suspended");
    expect(destinationFor("unverified")).toBe("/verify");
    expect(destinationFor("something-new")).toBe("/verify");
  });

  it("lets an approved courier in without redirect loops", () => {
    mockUser = courier("approved");
    renderAt("/");
    expect(screen.getByText("courier home")).toBeInTheDocument();
  });

  it("bounces an approved courier away from the pre-approval screens", () => {
    mockUser = courier("approved");
    for (const path of ["/verify", "/pending", "/rejected", "/suspended"]) {
      const { unmount } = renderAt(path);
      expect(screen.getByText("courier home")).toBeInTheDocument();
      unmount();
    }
  });

  it.each([
    ["pending", "pending screen"],
    ["rejected", "rejected screen"],
    ["suspended", "suspended screen"],
    ["unverified", "verify screen"],
  ])("sends a %s courier from the job screens to the right place", (status, expected) => {
    mockUser = courier(status);
    renderAt("/jobs");
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("treats a courier with no profile yet as unverified", () => {
    mockUser = courier(null);
    renderAt("/");
    expect(screen.getByText("verify screen")).toBeInTheDocument();
  });

  it("only shows each pre-approval screen to its own state", () => {
    mockUser = courier("pending");
    renderAt("/verify");
    expect(screen.getByText("pending screen")).toBeInTheDocument();
  });
});
