// Typed against `MascotCategoryKey` so a missing key is a compile error
// (same pattern as findings.en.ts / FindingCode).
import type { MascotCategoryKey } from "./mascotPrompts.tr";

export const mascotPromptsEn: Record<MascotCategoryKey, string> = {
  "disk-full": "Your disk is filling up — want to look at what's taking up space together?",
  "disk-health": "One of your disks has a health warning — want me to explain what it means?",
  chkdsk: "A disk/NTFS error was logged in the last 30 days. Curious what a chkdsk scan would do?",
  events: "A recurring error is showing up in the event log — want to talk through what it means?",
  drivers: "Some drivers are unsigned or old — want to figure out together which ones matter most?",
  virus:
    "There's something worth attention on the Virus/Defender side — want me to explain what to do?",
  thermal: "Your system seems to be running hot or throttling — want to dig into why together?",
  security: "There's a gap in your security settings (firewall/UAC) — want to know why it matters?",
  updates: "You have pending updates — want to talk through which ones matter most?",
  startup: "Your boot time looks slow — want to find out together what's slowing it down?",
  crashes: "There's a recurring crash/freeze lately — curious what might be causing it?",
  pagefile:
    "Your virtual memory setting could use a look — want me to explain why I'm suggesting this?",
  cleanup: "There's a fair amount of space you could reclaim — where do you want to start?",
} as const;
