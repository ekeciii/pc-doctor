//! DISM /RestoreHealth + sfc /scannow çalıştırır, stdout'u line-by-line
//! frontend'e `sfc-dism-progress` event'i ile yayınlar.

use crate::models::{ProgressLine, SfcDismSummary};
use std::collections::VecDeque;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const PROGRESS_EVENT: &str = "sfc-dism-progress";
const COMPLETE_EVENT: &str = "sfc-dism-complete";
const LOG_TAIL_LINES: usize = 30;

pub fn run(app: AppHandle) -> Result<SfcDismSummary, String> {
    let mut tail: VecDeque<String> = VecDeque::with_capacity(LOG_TAIL_LINES * 2);

    let dism_ok = run_phase(
        &app,
        "DISM",
        "dism.exe",
        &["/Online", "/Cleanup-Image", "/RestoreHealth"],
        &mut tail,
    )?;

    let (sfc_ok, sfc_repaired_files) = {
        let mut sfc_repaired = false;
        let mut sfc_phase_tail: VecDeque<String> = VecDeque::with_capacity(LOG_TAIL_LINES * 2);
        let ok = run_phase_with_inspect(
            &app,
            "SFC",
            "sfc.exe",
            &["/scannow"],
            &mut sfc_phase_tail,
            |line| {
                let lower = line.to_lowercase();
                if lower.contains("successfully repaired") {
                    sfc_repaired = true;
                }
            },
        )?;
        // sfc çıktısını ana tail'e ekle
        for l in sfc_phase_tail {
            push_tail(&mut tail, l);
        }
        (ok, sfc_repaired)
    };

    let summary = SfcDismSummary {
        dism_ok,
        sfc_ok,
        sfc_repaired_files,
        log_tail: tail.into_iter().collect::<Vec<_>>().join("\n"),
    };
    let _ = app.emit(COMPLETE_EVENT, &summary);
    Ok(summary)
}

fn run_phase(
    app: &AppHandle,
    phase: &str,
    program: &str,
    args: &[&str],
    tail: &mut VecDeque<String>,
) -> Result<bool, String> {
    run_phase_with_inspect(app, phase, program, args, tail, |_| {})
}

fn run_phase_with_inspect<F: FnMut(&str)>(
    app: &AppHandle,
    phase: &str,
    program: &str,
    args: &[&str],
    tail: &mut VecDeque<String>,
    mut inspect: F,
) -> Result<bool, String> {
    let mut cmd = Command::new(program);
    cmd.args(args).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("{} başlatılamadı: {}", program, e))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| format!("{} stdout alınamadı", program))?;
    let reader = BufReader::new(stdout);

    for raw in reader.split(b'\r') {
        let bytes = match raw {
            Ok(b) => b,
            Err(_) => continue,
        };
        // sfc bazen UTF-16'da yazar — UTF-8 olmazsa kayıpsız fallback
        let line = match std::str::from_utf8(&bytes) {
            Ok(s) => s.trim().trim_matches('\u{0}').to_string(),
            Err(_) => {
                let s: String = bytes.iter().map(|b| *b as char).collect();
                s.trim().trim_matches('\u{0}').to_string()
            }
        };
        if line.is_empty() {
            continue;
        }
        inspect(&line);
        push_tail(tail, line.clone());
        let percent = parse_percent(&line);
        let _ = app.emit(
            PROGRESS_EVENT,
            ProgressLine {
                phase: phase.into(),
                text: line,
                percent,
            },
        );
    }

    let status = child
        .wait()
        .map_err(|e| format!("{} bekleme hatası: {}", program, e))?;
    Ok(status.success())
}

fn push_tail(tail: &mut VecDeque<String>, line: String) {
    if tail.len() >= LOG_TAIL_LINES {
        tail.pop_front();
    }
    tail.push_back(line);
}

fn parse_percent(line: &str) -> Option<u8> {
    let idx = line.find('%')?;
    let prefix = &line[..idx];
    let num: String = prefix
        .chars()
        .rev()
        .take_while(|c| c.is_ascii_digit())
        .collect::<String>()
        .chars()
        .rev()
        .collect();
    if num.is_empty() {
        return None;
    }
    num.parse::<u8>().ok()
}
