-- login_kpi_template.sql
-- Assumption: events table schema
-- events(event_time timestamptz, event_name text, env text, session_id text,
--        request_id text, user_id text, device_id text, platform text,
--        app_version text, properties jsonb)

-- 1) 5-minute core KPI
WITH base AS (
  SELECT
    date_trunc('minute', event_time) - ((extract(minute from event_time)::int % 5) || ' minutes')::interval AS bucket_5m,
    event_name,
    COALESCE(user_id, device_id) AS actor_id,
    properties
  FROM events
  WHERE event_time >= now() - interval '24 hours'
    AND env = 'prod'
    AND event_name IN (
      'login_page_view','login_start','login_submit','login_result','token_refresh_result'
    )
), agg AS (
  SELECT
    bucket_5m,
    count(*) FILTER (WHERE event_name='login_page_view') AS login_page_view,
    count(*) FILTER (WHERE event_name='login_start') AS login_start,
    count(*) FILTER (WHERE event_name='login_submit') AS login_submit,
    count(*) FILTER (WHERE event_name='login_result' AND properties->>'result'='success') AS login_success,
    count(*) FILTER (WHERE event_name='login_result' AND properties->>'result'='fail') AS login_fail,
    count(*) FILTER (
      WHERE event_name='login_result'
        AND properties->>'result'='fail'
        AND (properties->>'error_layer' = 'server' OR (properties->>'http_status')::int >= 500)
    ) AS system_fail,
    count(DISTINCT actor_id) FILTER (
      WHERE event_name='login_result' AND properties->>'result'='fail'
    ) AS failed_users,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY NULLIF((properties->>'latency_ms')::numeric,0))
      FILTER (WHERE event_name='login_result' AND properties->>'result'='success') AS login_latency_p95_ms
  FROM base
  GROUP BY 1
)
SELECT
  bucket_5m,
  login_page_view,
  login_start,
  login_submit,
  login_success,
  login_fail,
  system_fail,
  failed_users,
  round((login_start::numeric / nullif(login_page_view,0)) * 100, 2) AS login_start_rate_pct,
  round((login_success::numeric / nullif(login_start,0)) * 100, 2) AS login_success_rate_pct,
  round((login_fail::numeric / nullif(login_submit,0)) * 100, 2) AS auth_fail_rate_pct,
  round((system_fail::numeric / nullif(login_submit,0)) * 100, 2) AS system_fail_rate_pct,
  round(login_latency_p95_ms, 0) AS login_latency_p95_ms
FROM agg
ORDER BY bucket_5m DESC;

-- 2) Top error codes (last 24h)
SELECT
  properties->>'error_code_std' AS error_code_std,
  count(*) AS fail_count,
  round(count(*)::numeric / sum(count(*)) OVER () * 100, 2) AS fail_pct
FROM events
WHERE event_time >= now() - interval '24 hours'
  AND env='prod'
  AND event_name='login_result'
  AND properties->>'result'='fail'
GROUP BY 1
ORDER BY fail_count DESC
LIMIT 10;

-- 3) Before vs After (D-7~D-1 vs last 48h)
WITH before_win AS (
  SELECT * FROM events
  WHERE event_time >= now() - interval '8 days'
    AND event_time <  now() - interval '1 day'
    AND env='prod'
), after_win AS (
  SELECT * FROM events
  WHERE event_time >= now() - interval '48 hours'
    AND env='prod'
), kpi AS (
  SELECT
    'before' AS period,
    count(*) FILTER (WHERE event_name='login_start') AS login_start,
    count(*) FILTER (WHERE event_name='login_result' AND properties->>'result'='success') AS login_success,
    count(*) FILTER (WHERE event_name='login_result' AND properties->>'result'='fail') AS login_fail,
    count(*) FILTER (WHERE event_name='login_result' AND properties->>'result'='fail'
      AND (properties->>'error_layer'='server' OR (properties->>'http_status')::int >= 500)) AS system_fail
  FROM before_win
  UNION ALL
  SELECT
    'after' AS period,
    count(*) FILTER (WHERE event_name='login_start') AS login_start,
    count(*) FILTER (WHERE event_name='login_result' AND properties->>'result'='success') AS login_success,
    count(*) FILTER (WHERE event_name='login_result' AND properties->>'result'='fail') AS login_fail,
    count(*) FILTER (WHERE event_name='login_result' AND properties->>'result'='fail'
      AND (properties->>'error_layer'='server' OR (properties->>'http_status')::int >= 500)) AS system_fail
  FROM after_win
)
SELECT
  period,
  login_start,
  login_success,
  login_fail,
  system_fail,
  round((login_success::numeric / nullif(login_start,0)) * 100, 2) AS login_success_rate_pct,
  round((system_fail::numeric / nullif(login_start,0)) * 100, 2) AS system_fail_rate_pct
FROM kpi;
