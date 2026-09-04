fn main() {
    let mut attrs = tauri_build::Attributes::new();

    #[cfg(windows)]
    {
        // tauri-build emits `cargo:dev=true|false`, which Cargo exposes to this
        // script via DEP_TAURI_DEV. (`#[cfg(dev)]` is NOT available in build.rs.)
        // We embed the requireAdministrator manifest ONLY in release builds so
        // `tauri dev` can spawn the binary from a non-elevated shell without
        // hitting ERROR_ELEVATION_REQUIRED (OS error 740).
        let is_dev = std::env::var("DEP_TAURI_DEV").as_deref() == Ok("true");
        if !is_dev {
            let windows =
                tauri_build::WindowsAttributes::new().app_manifest(include_str!("manifest.xml"));
            attrs = attrs.windows_attributes(windows);
        }
    }

    tauri_build::try_build(attrs).expect("tauri-build failed");
}
