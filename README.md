
  # ConnectEd

  This is a code bundle for ConnectEd. The original project is available at https://www.figma.com/design/Ewdw6q5CWum2wsbsCYvypl/ConnectEd.

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

## Environment Setup (REQUIRED)

Before running the application, you must configure Supabase environment variables:

1. Copy `.env.example` to `.env`:
     ```
     cp .env.example .env
     ```

2. Fill in your Supabase credentials in `.env`:
     - `VITE_SUPABASE_URL`: Your Supabase project URL (from Supabase dashboard → Settings → API)
     - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon/public key (from Supabase dashboard → Settings → API)
     - `VITE_SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (from Supabase dashboard → Settings → API)

**Without these variables, the application will fail to load calendar events, upload files, and perform other database operations.**

## Static Admin Login

Admin access now uses a single static account via the main login page (`/login`).

Optional environment variables:

- `VITE_STATIC_ADMIN_EMAIL` (default: `admin.connected.local`)
- `VITE_STATIC_ADMIN_PASSWORD_HASH` (SHA-256 hex, default corresponds to `@dminConnected`)

Example hash command:

- `node -e "const crypto=require('crypto'); console.log(crypto.createHash('sha256').update('Admin@123').digest('hex'))"`
  