//! Throwaway smoke test: run all four analyses against a path and print a
//! summary. Usage: cargo run --example smoke -- <path>
use xray_lib::commands::{churn, coupling, hotspots, loc, ownership};

fn main() {
    let path = std::env::args().nth(1).unwrap_or_else(|| "..".to_string());
    println!("Analyzing: {path}\n");

    let loc = loc::analyze_loc(path.clone()).unwrap();
    println!("LOC: {} files", loc.len());
    for f in loc.iter().take(3) {
        println!("  {:>5} loc  {}", f.code, f.path);
    }

    let hs = hotspots::analyze_hotspots(path.clone()).unwrap();
    println!("\nHotspots: {} files", hs.len());
    for f in hs.iter().take(3) {
        println!(
            "  score {:>5.1}  {} changes  {}",
            f.score, f.changes, f.path
        );
    }

    let ch = churn::analyze_churn(path.clone(), 3650).unwrap();
    println!("\nChurn: {} file·weeks", ch.len());
    for c in ch.iter().take(3) {
        println!("  {} {}  +{} -{}", c.week, c.path, c.added, c.deleted);
    }

    let cp = coupling::analyze_coupling(path.clone()).unwrap();
    println!("\nCoupling: {} pairs", cp.len());
    for p in cp.iter().take(3) {
        println!("  {}x  {}  <->  {}", p.count, p.file_a, p.file_b);
    }

    let ow = ownership::analyze_ownership(path).unwrap();
    println!("\nOwners: {} contributors", ow.len());
    for c in ow.iter().take(5) {
        println!(
            "  @{:<8} {:>3.0}%  {} files  {} commits",
            c.author,
            c.share * 100.0,
            c.owned_files,
            c.commits
        );
    }
}
