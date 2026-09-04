import { invoke } from "@tauri-apps/api/core";

export interface AppSettings {
  schemaVersion: number;
  locale: string;
  theme: "auto" | "light" | "dark";
  historyEnabled: boolean;
  historyRetentionDays: number;
  /** İlk-açılış veri-okuma bildiriminin hangi sürümü onaylandı (0 = hiç). */
  disclosureAckVersion: number;
  /** AI çekmecesindeki "veriniz yerel Ollama'ya gider" notu onaylandı mı. */
  aiDisclosureAck: boolean;
}

/** Backend `settings::CURRENT_DISCLOSURE_VERSION` ile senkron tutulmalı. */
export const CURRENT_DISCLOSURE_VERSION = 1;

const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 1,
  locale: "tr",
  theme: "auto",
  historyEnabled: true,
  historyRetentionDays: 90,
  disclosureAckVersion: 0,
  aiDisclosureAck: false,
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
