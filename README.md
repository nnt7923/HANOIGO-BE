# HanoiGo Backend

NestJS + MongoDB backend for discovering places, community reviews, notifications, and AI-generated itineraries around Hoa Lac/Hanoi.

## Architecture

The app uses feature-based modular architecture:

- `auth`: register/login, Google login, email OTP verification, password reset
- `users`: profile, admin role/subscription management
- `places`: place CRUD, owner/admin management, MongoDB geospatial search
- `reviews`: community reviews and place rating aggregation
- `itineraries`: Gemini-backed itinerary generation, MongoDB cache, usage limits
- `notifications`: user notifications and admin-created announcements
- `uploads`: Cloudinary image upload/delete endpoints
- `social`: follow graph, posts, feeds, likes, saves, comments, reports, moderation
- `common`: guards, decorators, enums, shared DTOs

## Setup

```bash
npm install
copy .env.example .env
npm run dev
```

Default local API:

- API: `http://localhost:5000/api`
- Swagger: `http://localhost:5000/docs`

## Required Environment

```bash
MONGODB_URI=mongodb://localhost:27017/hanoigo
JWT_SECRET=replace-with-a-long-random-secret
REFRESH_TOKEN_EXPIRES_DAYS=30
OTP_RESEND_COOLDOWN_SECONDS=60
```

Optional Gemini integration:

```bash
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
GEMINI_STRICT=false
```

Optional auth integrations:

```bash
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_IDS=
CLOUDINARY_URL=
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="HanoiGo <no-reply@hanoigo.local>"
SMTP_ALLOW_OTP_LOGGING=false
```

`SMTP_ALLOW_OTP_LOGGING=true` is only for local development. Keep it `false` outside local machines so OTP delivery requires real SMTP.

When `GEMINI_API_KEY` is empty, itinerary generation uses deterministic fallback planning while keeping the same API shape.

## Scripts

```bash
npm run build
npm run lint
npm test
npm run test:e2e
```
