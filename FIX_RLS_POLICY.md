# Fix: Missing RLS INSERT Policy on teacher_access_requests

## Problem Identified
The access request registration form is broken because the `teacher_access_requests` table has Row Level Security (RLS) enabled but is **missing an INSERT policy**. This blocks all new access request submissions from being saved to the database.

## What's Happening
1. When a user submits the access request form, it calls the `request-access` Edge Function
2. The function receives the data and tries to insert it into the `teacher_access_requests` table
3. The insert fails silently because no RLS INSERT policy exists
4. The user sees a confusing "already registered" error even though they're new

## Why This Happened
The RLS migration file (`20260515_teacher_access_requests_rls.sql`) only defined SELECT and UPDATE policies for authenticated admins. It forgot to include an INSERT policy, which is needed to allow users to submit new requests.

## How to Fix It (Manual Steps)

### Step 1: Go to Supabase Dashboard
1. Open https://supabase.com/dashboard/project/pyeckxqaowusxcmeuolk/sql
2. Sign in with your Supabase account

### Step 2: Create the Missing INSERT Policy
3. Click the "+ New Query" button
4. Paste this SQL:

```sql
-- Add INSERT policy to allow users to submit access requests
create policy if not exists teacher_access_requests_insert_public
on public.teacher_access_requests
for insert
to anon, authenticated
with check (true);
```

5. Click the "Run" button (▶️) to execute the SQL

### Step 3: Verify the Fix
6. After the query completes successfully, go back to the app
7. Try submitting an access request with a test email
8. The request should now be saved and appear in the admin panel

## What This SQL Does
- Creates an INSERT policy named `teacher_access_requests_insert_public`
- Applies to the `teacher_access_requests` table
- Allows both anonymous and authenticated users to insert records
- Uses `with check (true)` to allow all inserts (no restrictions)

##Related Files
- Edge Function: [supabase/functions/request-access/index.ts](supabase/functions/request-access/index.ts)
- Migration file (needs update): [supabase/migrations/20260515_teacher_access_requests_rls.sql](supabase/migrations/20260515_teacher_access_requests_rls.sql)
- Form: [src/app/pages/RequestAccess.jsx](src/app/pages/RequestAccess.jsx)
- Admin Panel: [src/app/pages/admin/AdminAccessRequests.jsx](src/app/pages/admin/AdminAccessRequests.jsx)

## After Fixing the Policy
Once the INSERT policy is applied:
1. Users can submit access requests
2. Requests appear in the admin panel with status "pending"
3. Admins can approve/reject and send invitation emails
4. Email will be sent IF RESEND_API_KEY is configured

**Note**: Email functionality also requires setting `RESEND_API_KEY` and `EMAIL_FROM` in Supabase Edge Functions Secrets.
