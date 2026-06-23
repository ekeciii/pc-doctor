//! Sprint 15 — yerel AI sohbeti (Ollama). Veri makineden ÇIKMAZ: 127.0.0.1:11434.
//!
//! Salt-açıklayıcı: model yalnız tarama bağlamını okur ve açıklar; hiçbir eylem çalıştırmaz.
//! Yanıt token token stream edilir → `ai-chat-token` event'leri; bitince `ai-chat-done`.

use serde::{Deserialize, Serialize};
use serde_json::json;
use std::io::{BufRead, BufReader};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const OLLAMA: &str = "http://127.0.0.1:11434";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// Yüklü Ollama modellerini listele. Ollama çalışmıyorsa hata döner (frontend kurulum gösterir).
pub fn list_models() -> Result<Vec<String>, String> {
    let resp = ureq::get(&format!("{OLLAMA}/api/tags"))
        .timeout(Duration::from_secs(5))
        .call()
        .map_err(|e| format!("Ollama'ya ulaşılamadı: {e}"))?;
    let v: serde_json::Value = resp.into_json().map_err(|e| e.to_string())?;
    let models = v
        .get("models")
        .and_then(|m| m.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(String::from))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    Ok(models)
}

/// Ollama /api/chat'e stream isteği; her parça `ai-chat-token`, bitiş `ai-chat-done` event'i.
pub fn stream_chat(app: &AppHandle, model: &str, messages: &[ChatMessage]) -> Result<(), String> {
    let body = json!({
        "model": model,
        "messages": messages,
        "stream": true,
        // Salt-okuma sohbet — düşük sıcaklık, tutarlı açıklama.
        "options": { "temperature": 0.4 }
    });

    let resp = ureq::post(&format!("{OLLAMA}/api/chat"))
        // Bağlantı için kısa, toplam akış için uzun süre (büyük modeller yavaş üretebilir).
        .timeout(Duration::from_secs(600))
        .send_json(body)
        .map_err(|e| format!("Ollama sohbet hatası: {e}"))?;

    let reader = BufReader::new(resp.into_reader());
    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(e) => {
                let _ = app.emit("ai-chat-error", e.to_string());
                return Err(e.to_string());
            }
        };
        if line.trim().is_empty() {
            continue;
        }
        let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) else {
            continue;
        };
        if let Some(content) = v
            .get("message")
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_str())
        {
            if !content.is_empty() {
                let _ = app.emit("ai-chat-token", content);
            }
        }
        if v.get("done").and_then(|d| d.as_bool()).unwrap_or(false) {
            break;
        }
    }
    let _ = app.emit("ai-chat-done", ());
    Ok(())
}
