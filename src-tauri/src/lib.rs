mod admin;
mod collectors;
mod commands;
mod diagnostics;
mod history;
mod models;
mod remediation;
mod safety;
mod settings;
mod util;

use crate::history::HistoryDb;
use crate::settings::{Settings, SettingsState};
use tauri::{Manager, RunEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Load persisted settings (or defaults)
            let loaded: Settings = settings::load(app.handle());
            app.manage(SettingsState::new(loaded));

            // Initialize history DB (best-effort — log errors but don't fail startup)
            match history::init(app.handle()) {
                Ok(db) => {
                    // Startup retention enforcement (secondary trigger; primary is in record_scan)
                    let snap = app.state::<SettingsState>().snapshot();
                    if let Ok(guard) = db.conn.lock() {
                        if let Err(e) = history::retention::enforce(&guard, snap.history_retention_days) {
                            eprintln!("[history] startup retention skip: {e}");
                        }
                        // PRAGMA optimize: hint SQLite to reorganize stats once per session
                        let _ = guard.execute_batch("PRAGMA optimize;");
                    }
                    app.manage::<HistoryDb>(db);
                }
                Err(e) => eprintln!("[history] init failed: {e}"),
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan,
            commands::list_cleanup_targets,
            commands::create_restore_point,
            commands::is_system_restore_enabled,
            commands::execute_cleanup,
            commands::is_elevated,
            commands::relaunch_as_admin,
            commands::run_system_file_check,
            commands::run_defender_quick_scan,
            commands::run_chkdsk_scan,
            commands::cancel_chkdsk_scan,
            commands::run_chkdsk_fix,
            commands::cancel_chkdsk_session,
            commands::schedule_chkdsk_reboot,
            commands::abort_chkdsk_reboot,
            commands::query_pending_chkdsk,
            commands::query_pending_chkdsks,
            commands::cancel_pending_chkdsk,
            commands::fetch_last_chkdsk_result,
            commands::check_chkdsk_scheduled_volumes,
            commands::open_system_properties_performance,
            commands::open_oem_link,
            settings::get_settings,
            settings::save_settings,
            history::commands::record_scan,
            history::commands::list_scans,
            history::commands::list_scan_findings,
            history::commands::scan_findings_trend,
            history::commands::scan_findings_trend_batch,
            history::commands::clear_history,
        ])
        .build(tauri::generate_context!())
        .expect("error while building PC Doctor")
        .run(|_app, event| {
            // Sprint 7 (E) + Sprint 8 ext + Sprint 9 review C1+C2 fix: app exit hook.
            // SADECE live child session (LiveScan/LiveFix) öldürülür; ScheduledFix KORUNUR
            // (kullanıcı bilinçli kararıydı, sonraki launch'ta ChkdskPendingBanner sorar).
            // Yanlış davranış: cancel_scan() ScheduledFix dalında chkntfs::cancel çağırıyordu →
            // kullanıcının autochk planını sessizce siliyor (invariant #22 ihlali).
            if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
                let chk_killed = remediation::chkdsk::cancel_live_only();
                let reboot_killed = remediation::reboot::kill_pending_reboot_countdown();
                if chk_killed {
                    eprintln!("[lifecycle] running chkdsk live session killed on app exit");
                }
                if reboot_killed {
                    eprintln!("[lifecycle] shutdown countdown child killed on app exit");
                }
            }
        });
}
