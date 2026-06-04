import { check, Update } from "@tauri-apps/plugin-updater";

export interface AvailableUpdate {
  version: string;
  notes: string | undefined;
  date: string | undefined;
  /** İndirme + kurma için handle. */
  raw: Update;
}

/**
 * Yapılandırılmış endpoint'i kontrol eder.
 * Hiç güncelleme yoksa null döner. Ağ/endpoint hatasında throw eder.
 */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  const update = await check();
  if (!update) return null;
  return {
    version: update.version,
    notes: update.body,
    date: update.date,
    raw: update,
  };
}

/**
 * İndir + kur. progress callback opsiyonel (downloadAndInstall iç event'leriyle).
 * Yükleme bitince uygulama kapatılmalı (Tauri auto-relaunch yapabilir).
 */
export async function installUpdate(
  update: AvailableUpdate,
  onProgress?: (downloaded: number, total: number | null) => void
): Promise<void> {
  let downloaded = 0;
  let contentLength: number | null = null;
  await update.raw.downloadAndInstall((event) => {
    if (event.event === "Started") {
      contentLength = event.data.contentLength ?? null;
      onProgress?.(0, contentLength);
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      onProgress?.(downloaded, contentLength);
    } else if (event.event === "Finished") {
      onProgress?.(contentLength ?? downloaded, contentLength);
    }
  });
}
