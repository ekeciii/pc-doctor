import { describe, it, expect } from "vitest";
import {
  toError,
  NeedsElevationError,
  RestoreFailedError,
  ScheduleInconsistentError,
  VolumeLockedError,
  NEEDS_ELEVATION_SENTINEL,
  RESTORE_FAILED_SENTINEL,
  SCHEDULE_INCONSISTENT_SENTINEL,
  VOLUME_LOCKED_SENTINEL,
} from "../api";

/**
 * Backend, elevation/restore/schedule/volume hatalarını `Sentinel: mesaj`
 * önekiyle string olarak döndürür. `toError` bunları tip-güvenli Error
 * alt sınıflarına ayrıştırmalı — frontend bu tiplere göre farklı UI
 * (elevation banner, recovery banner, vb.) gösteriyor. Yanlış ayrıştırma
 * = kullanıcı yanlış/ham hata görür. Bu, click-to-destructive-action
 * gating'inin dayandığı en kritik saf mantık.
 */
describe("toError sentinel parsing", () => {
  it("maps NeedsElevation sentinel to NeedsElevationError and strips the prefix", () => {
    const err = toError(`${NEEDS_ELEVATION_SENTINEL}: yönetici yetkisi gerekli`);
    expect(err).toBeInstanceOf(NeedsElevationError);
    expect(err.message).toBe("yönetici yetkisi gerekli");
  });

  it("maps RestoreFailed sentinel to RestoreFailedError", () => {
    const err = toError(`${RESTORE_FAILED_SENTINEL}: VSS kapalı`);
    expect(err).toBeInstanceOf(RestoreFailedError);
    expect(err.message).toBe("VSS kapalı");
  });

  it("maps ScheduleInconsistent sentinel to ScheduleInconsistentError", () => {
    const err = toError(`${SCHEDULE_INCONSISTENT_SENTINEL}: C plan temizlenemedi`);
    expect(err).toBeInstanceOf(ScheduleInconsistentError);
    expect(err.message).toBe("C plan temizlenemedi");
  });

  it("maps VolumeLocked sentinel to VolumeLockedError", () => {
    const err = toError(`${VOLUME_LOCKED_SENTINEL}: sürücü kullanımda`);
    expect(err).toBeInstanceOf(VolumeLockedError);
    expect(err.message).toBe("sürücü kullanımda");
  });

  it("falls back to a plain Error for unknown messages (no false positive)", () => {
    const err = toError("rastgele bir hata");
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(NeedsElevationError);
    expect(err.message).toBe("rastgele bir hata");
  });

  it("accepts an Error input and routes by its message", () => {
    const err = toError(new Error(`${NEEDS_ELEVATION_SENTINEL}: x`));
    expect(err).toBeInstanceOf(NeedsElevationError);
  });

  it("does NOT misclassify a sentinel word appearing mid-message", () => {
    // Önek değil — gövdede geçiyor; düz Error kalmalı.
    const err = toError(`işlem başarısız: ${NEEDS_ELEVATION_SENTINEL} kontrolü`);
    expect(err).not.toBeInstanceOf(NeedsElevationError);
  });
});
