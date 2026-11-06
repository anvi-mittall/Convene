# Assumptions Log

1. **Test Runner & Module Format**: Plain JavaScript ES modules (`"type": "module"`) with Vitest chosen for fast, native ESM support without Babel transpilation.
2. **In-Memory Mongo Testing**: `mongodb-memory-server` used for hermetic, fast, and isolated testing across all phase suites without requiring external database services.
3. **Icons & UI Kit**: `lucide-react` used for consistent, accessible iconography across UI badges, action buttons, scanner controls, and dashboard tabs.
4. **Registration Document Lifecycle**: Single registration document per user-event pair enforced by a compound unique index `{ user: 1, event: 1 }`. Re-registering after cancellation reuses and transitions the existing document state to avoid duplicate records.
5. **PDF Certificate Streaming**: PDFKit streams generated landscape A4 certificates directly to the HTTP response (`Content-Type: application/pdf`) without writing temporary files to disk.
6. **Mailer Strategy**: Safe console fallback when SMTP environment variables are unconfigured, logging all notification recipients and email content to `stdout`.
7. **Cross-Origin Resource Policy (CORP)**: Added `Cross-Origin-Resource-Policy: cross-origin` header on the static uploads route (`/uploads/posters`) to allow frontend browsers to load local images seamlessly under Helmet protection.
8. **Rate Limiting in Test Mode**: Auth rate limiters automatically bypass throttling when `NODE_ENV === 'test'` to permit high-volume concurrent test execution.
