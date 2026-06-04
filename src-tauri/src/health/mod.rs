//! Faz 1 — sağlık skoru. Bulgulardan 0-100 deterministik, açıklanabilir skor üretir.
pub mod score;

pub use score::{compute_health, HealthScore};
