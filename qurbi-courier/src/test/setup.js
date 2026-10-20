import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import i18n from "@/i18n";

// The app defaults to Malay; tests assert on the English copy.
i18n.changeLanguage("en");

afterEach(() => cleanup());

// jsdom has no object-url support.
if (!URL.createObjectURL) {
  let counter = 0;
  URL.createObjectURL = () => `blob:test/${++counter}`;
  URL.revokeObjectURL = () => {};
}
