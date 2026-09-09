import { describe, expect, it } from "vitest";
import { CATEGORIES } from "../../../components/categoryDefs";
import { mascotPromptsTr } from "../mascotPrompts.tr";
import { mascotPromptsEn } from "../mascotPrompts.en";

describe("mascotPrompts kapsama", () => {
  it("her CATEGORIES key'i için TR sorusu var", () => {
    for (const cat of CATEGORIES) {
      expect(mascotPromptsTr, `TR eksik: ${cat.key}`).toHaveProperty(cat.key);
      expect(mascotPromptsTr[cat.key as keyof typeof mascotPromptsTr].length).toBeGreaterThan(0);
    }
  });

  it("her CATEGORIES key'i için EN sorusu var", () => {
    for (const cat of CATEGORIES) {
      expect(mascotPromptsEn, `EN eksik: ${cat.key}`).toHaveProperty(cat.key);
      expect(mascotPromptsEn[cat.key as keyof typeof mascotPromptsEn].length).toBeGreaterThan(0);
    }
  });
});
