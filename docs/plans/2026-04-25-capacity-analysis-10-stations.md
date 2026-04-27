---
date: 2026-04-25
topic: "Capacity sidecar: can the current Docker stack on an i7 / 32GB mini-PC sustain 10 checkout stations?"
author: Caleb Bennett
status: analysis
tags:
  - capacity
  - sale-day
  - hampton-hawks-plant-sales
---

# Capacity Analysis -- 10 Stations on i7 / 32 GB Mini-PC

This is **not a design** -- it's a sidecar review of whether the current architecture can support next year's target of ~10 concurrent checkout stations on a small mini-PC host. The answer is short: **yes, with modest tuning**. The detail below explains why and what to verify before sale day.

## The Workload (Estimated)

The spring sale ran 5 stations smoothly. Doubling to 10 stations means:

- **Peak scan rate per station:** roughly 1 scan/sec during a busy customer (sale-day reality, not sustained).
- **Sustained rate per station:** much lower (~1 scan / 5-10 sec across an hour).
- **Aggregate peak:** ~10 scans/sec across all stations is a reasonable upper bound during a rush.
- **Aggregate sustained:** 1-2 scans/sec.

Each scan is:
- 1 HTTP POST to `/api/pickup/scan` (or future `/api/walkup-register/draft/{id}/scan`).
- One short DB transaction: `BeginTransaction` -> 2-3 `SELECT ... FOR UPDATE` -> 1-2 `UPDATE` -> `Commit`. Sub-100 ms per transaction on a healthy local Postgres.

Add the new bundle workloads from this brainstorm cycle:
- **Bulk operations** (Quick Wins SS-03): admin-driven, rare during peak sale, capped at 500 orders/call.
- **Reports** (Quick Wins SS-05): admin-driven, occasional.
- **Walk-up register** (Walk-up SS-02): roughly doubles scan rate at stations running register flow vs. preorder flow. Still bounded.
- **Pick-list session** (Pick-list SS-02): same per-scan cost as today, just routed through an aggregation layer.

**Realistic worst case (sustained):** 20 scans/sec aggregated across preorder + walk-up at 10 stations. That's well within the comfort zone of a single-instance Postgres on the described hardware.

## Hardware Headroom

**i7 / 32 GB mini-PC running Docker Compose (postgres + api + web):**

- **CPU:** Any modern i7 has 8-16 cores. Idle Postgres + .NET API at this workload uses single-digit % CPU.
- **RAM:** Postgres 16 default `shared_buffers = 128 MB` (very low for 32 GB host). The API process is ~150-300 MB. The web container (Nginx + static assets) is ~30 MB. With 32 GB available, there's massive headroom.
- **Disk:** Postgres data fits comfortably in RAM during a sale day; cold reads are rare. SSD assumed -- if the mini-PC has spinning rust, replace before sale day.
- **Network:** LAN-only. 10 stations on a wired or strong wifi link easily handles the request volume; each request payload is small (KB range).

**Verdict:** the bottleneck on this hardware is not CPU, RAM, disk, or network. The bottleneck, if any, will be **per-row contention** on hot data (a popular plant being scanned by multiple stations simultaneously) or **Postgres connection pool exhaustion** if connections are leaked.

## Concerns and Mitigations

### 1. Postgres tuning defaults are conservative
Default settings on `postgres:16` are tuned for a tiny shared instance. On a 32 GB host, raise these:
- `shared_buffers` -> `2GB` (typical 25% of dedicated RAM, but moderated for a host running other services)
- `effective_cache_size` -> `8GB`
- `max_connections` -> 200 (default 100 is fine but a small bump helps headroom)
- `work_mem` -> `32MB` (helps report aggregations)
- `wal_buffers` -> `16MB`

**Recommended action:** add a `postgres.conf` mount in `docker-compose.yml` with these values, or pass via `-c` CLI flags. Test in dev first.

### 2. Connection pool exhaustion under bursts
.NET Npgsql defaults to a small pool. If under burst the pool is exhausted, the API throws timeouts. Configuration:
- `Pooling=true; MinPoolSize=10; MaxPoolSize=200` in the connection string.
- Verify the API never holds connections across HTTP requests (it shouldn't -- EF Core scopes per-request).

**Recommended action:** add explicit pool sizing to `ConnectionStrings__Default` in `docker-compose.yml`.

### 3. Row contention on hot plants
Two stations scanning the same popular plant serialize on `SELECT FOR UPDATE`. Worst-case lock duration: 50-100 ms per scan. With 10 stations all racing on one plant -- which won't happen in practice -- worst-case throughput is ~10 scans/sec on that one plant.

**Mitigation:** none needed. The pattern is correct; the math doesn't break sale-day expectations. If a single plant is the entire stockroom (unlikely), revisit.

### 4. Sustained heat under 4-6 hour sale window
Mini-PCs throttle when their thermal envelope is exceeded. CPU load in this workload is low (<5% sustained) so heat shouldn't be the issue, but:
- Verify the mini-PC has clear airflow at its sale-day location.
- Don't stack it under a registers' bag pile.

### 5. Postgres single instance = single point of failure
If Postgres restarts mid-sale, everything stops. Today's `restart: always` policy in `docker-compose.yml` handles transient crashes; the WAL ensures no committed data is lost.

**Mitigation:** keep daily backups during the sale (`pg_dump` to USB at start and at end). The pickle is recovery time on a hardware failure -- if the mini-PC dies, there's no hot standby. For a plant sale, this is acceptable risk; for a high-stakes deployment, it would not be.

### 6. Web container static asset cache
The web container serves a built React bundle. After 10 stations load it once, subsequent loads are cache hits. No concern.

### 7. WAL volume growth
A busy sale day generates WAL segments. The volume is mounted at `postgres_data:/var/lib/postgresql/data`. Verify the host has at least 5 GB of free disk dedicated to this volume; checkpoints clean up segments but bursts can grow.

## What to Verify Before Sale Day

1. **Run a synthetic load test:** simulate 10 concurrent stations scanning random plants for 10 minutes. Measure: p50/p99 scan latency, error rate, Postgres connection count, CPU/RAM. A simple `bash` + `curl` loop or `k6` script suffices.
2. **Apply the Postgres tuning above** (or a subset) and re-run.
3. **Stress the bulk-complete endpoint** with 500 orders selected. Measure response time. If > 5s, lower the cap.
4. **Smoke the walk-up register concurrent decrement test** (covered in Walk-up SS-02 acceptance criteria).
5. **Test report queries** with a sale-day-sized dataset (5000+ orders, 25000+ lines). Verify no query exceeds 2-3 seconds.

## Bottom Line

The current architecture comfortably supports 10 stations on the described hardware. The only deliberate work needed is:

- Postgres tuning patch in `docker-compose.yml` or a sidecar config file (low effort, high impact).
- Connection-string pool sizing on the API (one-line change).
- A pre-sale load test to validate, not as a gate.

No architectural change is necessary. The transactional row-lock contract used throughout the system serializes contention correctly, and the workload sits well below the host's headroom.

## Recommended Follow-Up Spec

Worth a small one-shot spec: **"Pre-Sale Capacity Hardening"** -- add the Postgres tuning conf, connection pool sizing, and a documented synthetic load test runner. Maybe one sub-spec, ships in a single PR.
