// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AuthScreen from "../src/features/auth/AuthScreen";

describe("account-free first launch", () => {
  it("offers guest planning without attempting registration", () => {
    const enterGuest = vi.fn();
    const accountLogin = vi.fn();
    render(<AuthScreen onGuest={enterGuest} onLogin={accountLogin} />);
    fireEvent.click(screen.getByRole("button", { name: "Explore Pulse as a guest" }));
    expect(enterGuest).toHaveBeenCalledTimes(1);
    expect(accountLogin).not.toHaveBeenCalled();
    expect(screen.getByText(/Guest trips stay on this phone/)).toBeTruthy();
  });
});
