# Goodjob Kotlin task API

This is an isolated learning API. It never writes to the existing Supabase workspace.

## Run with MySQL

Set every variable shown in `.env.example`, then run `./mvnw spring-boot:run`. The server binds to `127.0.0.1:8080` by default. Credentials have no production defaults. Basic authentication is stateless and uses only the explicit `Authorization` header; no session or cookie authentication is enabled.

For the explicit H2 practice profile, set `GOODJOB_USERNAME` and `GOODJOB_PASSWORD` and run `./mvnw spring-boot:run -Dspring-boot.run.profiles=local`. H2 is persistent in `./data`, but passing H2 tests is not MySQL verification.

Remote use requires TLS and a new authentication/security review. Basic credentials may be cached by browsers, so state-changing browser requests carrying an `Origin` header are accepted only from `GOODJOB_ALLOWED_ORIGIN`. CLI and the same-host Next proxy send explicit Basic headers without an Origin header. Requests are stateless, capped at 16 KiB, rate-limited in one process, and returned with `Cache-Control: no-store`.

OpenAPI documentation is in `openapi.yaml` and describes authenticated endpoints only.
