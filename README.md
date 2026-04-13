
  # ConnectEd

  This is a code bundle for ConnectEd. The original project is available at https://www.figma.com/design/Ewdw6q5CWum2wsbsCYvypl/ConnectEd.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Static Admin Login

  Admin access now uses a single static account via the main login page (`/login`).

  Optional environment variables (recommended):

  - `VITE_STATIC_ADMIN_EMAIL` (default: `admin.connected.local`)
  - `VITE_STATIC_ADMIN_PASSWORD_HASH` (SHA-256 hex, default corresponds to `@dminConnected`)

  Example hash command:

  - `node -e "const crypto=require('crypto'); console.log(crypto.createHash('sha256').update('Admin@123').digest('hex'))"`
  