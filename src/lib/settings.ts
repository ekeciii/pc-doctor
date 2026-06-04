import { invoke } from "@tauri-apps/api/core";

export interface AppSettings {
  schemaVersion: number;
  locale: string;
  theme: "auto" | "light" | "dark";
  telemetryEnabled: boolean;
  historyEnabled: boolean;
  historyRetentionDays: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 1,
  locale: "tr",
  theme: "auto",
  telemetryEnabled: false,
  historyEnabled: true,
  historyRetentionDays: 90,
};

export async function getSettings(): Promise<AppSettings> {
  try {
    return await invoke<AppSettings>("get_settings");
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  return invoke<AppSettings>("save_settings", { settings });
}
