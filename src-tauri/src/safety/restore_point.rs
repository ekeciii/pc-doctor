use crate::models::AppError;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn powershell(args: &[&str]) -> Result<String, AppError> {
    let mut cmd = Command::new("powershell.exe");
    cmd.args(["-NoProfile", "-NonInteractive", "-Command"]);
    cmd.args(args);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let output = cmd.output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(AppError::PowerShell(stderr));
    }
    Ok(String::from_utf8(output.stdout)?)
}

pub fn is_enabled() -> bool {
    let script = "(Get-ComputerRestorePoint -ErrorAction SilentlyContinue) | Out-Null; \
                  $svc = Get-Service -Name VSS -ErrorAction SilentlyContinue; \
                  if ($null -eq $svc) { 'no' } else { 'yes' }";
    match powershell(&[script]) {
        Ok(out) => out.trim().eq_ignore_ascii_case("yes"),
        Err(_) => false,
    }
}

pub fn create(description: &str) -> Result<(), AppError> {
    let safe_desc = description.replace('\'', "''");
    let script = format!(
        "Checkpoint-Computer -Description '{}' -RestorePointType 'MODIFY_SETTINGS'",
        safe_desc
    );
    powershell(&[&script])?;
    Ok(())
}
