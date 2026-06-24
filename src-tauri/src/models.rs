use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct FileStat {
    pub path: String,
    pub directory: String,
    pub extension: String,
    pub code: usize,
    pub blank: usize,
    pub comment: usize,
}

#[derive(Serialize, Clone)]
pub struct HotspotStat {
    pub path: String,
    /// normalized: (norm_changes + norm_loc) / 2 * 100
    pub score: f64,
    pub changes: usize,
    pub code: usize,
}

#[derive(Serialize, Clone)]
pub struct ChurnWeekStat {
    pub path: String,
    /// ISO week, e.g. "2025-W12"
    pub week: String,
    pub added: usize,
    pub deleted: usize,
    pub churn: usize,
}

#[derive(Serialize, Clone)]
pub struct CouplingPair {
    pub file_a: String,
    pub file_b: String,
    pub count: usize,
}
