import { describe, it, expect } from "vitest";
import { BarcodeFormat } from "@zxing/library";
import {
  normalizeManualEntry,
  isDuplicate,
  formatToString,
} from "../scannerHelpers";

describe("normalizeManualEntry", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeManualEntry("  ABC123  ")).toBe("ABC123");
  });

  it("preserves interior whitespace", () => {
    expect(normalizeManualEntry("ABC 123")).toBe("ABC 123");
  });

  it("returns empty string unchanged when empty", () => {
    expect(normalizeManualEntry("")).toBe("");
  });

  it("trims only leading whitespace", () => {
    expect(normalizeManualEntry("  hello")).toBe("hello");
  });

  it("trims only trailing whitespace", () => {
    expect(normalizeManualEntry("hello  ")).toBe("hello");
  });
});

describe("isDuplicate", () => {
  it("returns true when same code within cooldown window", () => {
    expect(isDuplicate("X", 0, "X", 999, 1000)).toBe(true);
  });

  it("returns false when same code at exactly cooldown boundary", () => {
    expect(isDuplicate("X", 0, "X", 1000, 1000)).toBe(false);
  });

  it("returns false when different code regardless of timing", () => {
    expect(isDuplicate("X", 0, "Y", 50, 1000)).toBe(false);
  });

  it("returns false when prevCode is null", () => {
    expect(isDuplicate(null, 0, "X", 50, 1000)).toBe(false);
  });

  it("returns false when same code beyond cooldown window", () => {
    expect(isDuplicate("X", 0, "X", 2000, 1000)).toBe(false);
  });
});

describe("formatToString", () => {
  it("maps QR_CODE to qr-code", () => {
    expect(formatToString(BarcodeFormat.QR_CODE)).toBe("qr-code");
  });

  it("maps UPC_A to upc-a", () => {
    expect(formatToString(BarcodeFormat.UPC_A)).toBe("upc-a");
  });

  it("maps UPC_E to upc-e", () => {
    expect(formatToString(BarcodeFormat.UPC_E)).toBe("upc-e");
  });

  it("maps EAN_13 to ean-13", () => {
    expect(formatToString(BarcodeFormat.EAN_13)).toBe("ean-13");
  });

  it("maps EAN_8 to ean-8", () => {
    expect(formatToString(BarcodeFormat.EAN_8)).toBe("ean-8");
  });

  it("maps CODE_128 to code-128", () => {
    expect(formatToString(BarcodeFormat.CODE_128)).toBe("code-128");
  });

  it("maps CODE_39 to code-39", () => {
    expect(formatToString(BarcodeFormat.CODE_39)).toBe("code-39");
  });

  it("returns undefined for unsupported format", () => {
    expect(formatToString(BarcodeFormat.AZTEC)).toBeUndefined();
  });

  it("returns undefined for CODABAR", () => {
    expect(formatToString(BarcodeFormat.CODABAR)).toBeUndefined();
  });
});
