Deployment Notes

API Base URL (Vercel-safe)

- App reads `VITE_API_BASE_URL` at build time.
- Development: if not set, uses same-origin ('') so Vite proxy forwards requests to your backend.
- Production (Vercel): set `VITE_API_BASE_URL` in Project Settings → Environment Variables to your fixed API endpoint (e.g., https://api.example.com). This prevents base URL from changing on Vercel preview domains.

Local .env example

VITE_API_BASE_URL=https://api.example.com

