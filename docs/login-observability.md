# Login Observability (Hotfix)

## KPI
- login_start_rate = `login_start / login_page_view`
- login_success_rate = `login_success / login_start`
- step_dropoff_rate = `1 - next_step/current_step`
- auth_fail_rate = `auth_fail / login_submit`
- system_fail_rate = `system_fail / login_submit`
- login_latency_p95 = `p95(login_success_ts - login_start_ts)`
- failed_users_30m = `count(distinct user_or_device_id where fail)`

## Required Events
Common fields:
- `event_time` (UTC), `event_name`, `env`, `session_id`, `request_id`, `user_id`(optional), `device_id`, `platform`, `app_version`

Events:
1. `login_page_view`
2. `login_start` (`login_method`, `attempt_no`)
3. `login_submit` (`login_method`, `id_type`, `attempt_no`)
4. `login_challenge` (`challenge_type`, `provider`) [optional]
5. `login_result` (`result`, `error_code_std`, `raw_error_code`, `error_layer`, `http_status`, `latency_ms`)
6. `token_refresh_result` (`result`, `error_code_std`, `latency_ms`)
7. `logout` (`reason`)
8. `login_retry` (`previous_error_code_std`, `retry_after_sec`)

## Error Code Standard
Format: `L-{DOMAIN}-{DETAIL}`

- `L-AUTH-INVALID_CREDENTIALS`
- `L-AUTH-ACCOUNT_LOCKED`
- `L-AUTH-TOKEN_EXPIRED`
- `L-INPUT-MALFORMED_REQUEST`
- `L-RATE-TOO_MANY_REQUESTS`
- `L-SYS-INTERNAL_ERROR`
- `L-NET-TIMEOUT`
- `L-VENDOR-OAUTH_PROVIDER_FAIL`
- `L-UNKNOWN-UNCLASSIFIED`

Rules:
- Store both `raw_error_code` and `error_code_std`
- Single shared mapping table for client/server
- Unknowns collected under `L-UNKNOWN-*` and reviewed weekly

## Alert Rules
- Warning: login success rate < 95% (5m moving average, 2 consecutive)
- Critical: login success rate < 90% OR failed users >= 200 in 10m
- Warning/Critical: system fail rate > 1% / > 3%
- Warning/Critical: login latency p95 > 4s / > 7s
- Warning: specific error code spike +200% vs 30m baseline
- Critical: no `login_result` events for 5m

## Report Template (Hotfix Before/After)
1. Release meta (version, time, changes, platform)
2. KPI comparison (D-7~D-1 vs +48h)
3. Top 5 error code changes
4. Segment breakdown (platform/app_version/country/network)
5. Conclusion (risk level, owner, due date)
