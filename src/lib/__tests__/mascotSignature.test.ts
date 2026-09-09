import { describe, expect, it } from "vitest";
import { computeFindingSignature, shouldShowMascot } from "../mascotSignature";
import type { Finding } from "../types";

function finding(id: string): Finding {
  return {
    id,
    category: "Disk",
    title: "",
    description: "",
    severity: "critical",
    metric: null,
    recommendedAction: null,
    action: null,
  };
}

describe("computeFindingSignature", () => {
  it("bulgu id'lerini sıralı birleştirir, sırayı görmezden gelir", () => {
    const a = computeFindingSignature([finding("b"), finding("a")]);
    const b = computeFindingSignature([finding("a"), finding("b")]);
    expect(a).toBe(b);
  });

  it("farklı bulgu kümesi için farklı imza üretir", () => {
    const a = computeFindingSignature([finding("a")]);
    const b = computeFindingSignature([finding("a"), finding("b")]);
    expect(a).not.toBe(b);
  });

  it("boş liste için boş string döner", () => {
    expect(computeFindingSignature([])).toBe("");
  });
});

describe("shouldShowMascot", () => {
  it("kategori daha önce hiç görülmediyse true döner", () => {
    expect(shouldShowMascot("disk-full", "sig-1", {})).toBe(true);
  });

  it("aynı imzayla ikinci kez false döner", () => {
    const seen = { "disk-full": "sig-1" };
    expect(shouldShowMascot("disk-full", "sig-1", seen)).toBe(false);
  });

  it("imza değişince tekrar true döner", () => {
    const seen = { "disk-full": "sig-1" };
    expect(shouldShowMascot("disk-full", "sig-2", seen)).toBe(true);
  });
});
