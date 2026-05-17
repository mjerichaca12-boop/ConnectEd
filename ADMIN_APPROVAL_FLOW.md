# Admin Approval Flow - Complete Checklist

## Status: Deploying fix for access request approval workflow

### Issues Fixed
1. ✅ Enhanced admin-access-requests function with detailed logging
2. ✅ Added approval action logging to track status updates
3. ✅ Verified send-invitation function is complete
4. ✅ Verified RLS policies are in place for SELECT, UPDATE, and INSERT
5. ✅ Added stale session handling to supabaseClient
6. ✅ Added graceful error handling for missing service role key

### Workflow Steps Verified

#### Step 1: User Submits Access Request (RequestAccess.jsx)
- ✅ Form collects: email, firstName, lastName, phone, schoolName, position, subjects
- ✅ Calls request-access Edge Function
- ✅ Function checks for existing profiles and access requests
- ✅ Inserts into teacher_access_requests table with status="pending"
- ✅ Returns success confirmation

#### Step 2: Admin Views Requests (AdminAccessRequests.jsx)
- ✅ Component loads on mount with loadAccessRequests()
- ✅ Calls admin-access-requests function with action="list"
- ✅ Function fetches all requests from teacher_access_requests table
- ✅ Normalizes status values (pending, approved, rejected, invited)
- ✅ Displays in table with filter tabs (All, Pending, Approved, Rejected, Invited)

#### Step 3: Admin Approves Request
- ✅ Click "Approve" button triggers handleApproveAndSendInvite()
- ✅ Calls admin-access-requests with action="approve"
- ✅ Function updates status to "approved"
- ✅ Returns updated request object

#### Step 4: Send Invitation Email
- ✅ After approval, calls send-invitation Edge Function
- ✅ Function:
  - Verifies request exists and status="approved"
  - Generates 32-byte invitation token
  - Hashes token with SHA-256
  - Stores in teacher_invitation_tokens table
  - Updates access request status to "invited"
  - Sends email with invitation link
- ✅ Returns success with message "Email sent"

#### Step 5: Admin Panel Updates
- ✅ Calls loadAccessRequests() again
- ✅ Refreshes request list showing updated status

### Database Tables Involved
1. teacher_access_requests
   - id (uuid, pk)
   - email (text)
   - profile_id (uuid, fk)
   - first_name, middle_name, last_name (text)
   - phone, school_name, position (text)
   - subjects (text[])
   - additional_info (text)
   - status (pending/approved/rejected/invited)
   - created_at, requested_at (timestamp)
   - reviewed_at, reviewed_by (timestamp, text)
   - admin_notes (text)

2. teacher_invitation_tokens
   - id (uuid, pk)
   - email (text)
   - token_hash (text, unique)
   - token_plain (text)
   - expires_at (timestamp)
   - used_at (timestamp, nullable)
   - created_at (timestamp)
   - created_by (text)

3. profiles
   - id (uuid, pk)
   - email (text, unique)
   - role (admin/teacher/student)
   - is_verified (boolean)
   - created_at (timestamp)

### RLS Policies (teacher_access_requests)
1. SELECT (admin only)
   - Allows authenticated users with role="admin" to view all requests

2. UPDATE (admin only)
   - Allows authenticated users with role="admin" to update request status

3. INSERT (public)
   - Allows anonymous and authenticated users to submit new requests

### Edge Functions Deployed
1. request-access
   - Validates email and name
   - Checks for existing profiles and requests
   - Inserts new request with status="pending"
   - Returns {ok: true, requestId, message}

2. admin-access-requests
   - action="list": Returns all requests sorted by date
   - action="approve": Updates status to "approved", returns updated request
   - action="reject": Updates status to "rejected", returns updated request
   - action="delete": Deletes request record

3. send-invitation
   - Verifies request status="approved"
   - Generates invitation token
   - Stores token in teacher_invitation_tokens
   - Sends email via Resend API
   - Updates status to "invited"
   - Returns {ok: true, message: "Email sent"}

### Environment Variables Required
1. In .env (Frontend)
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
   - PUBLIC_SITE_URL (for invitation links)

2. In Supabase Edge Functions → Secrets
   - SUPABASE_URL (auto)
   - SUPABASE_SERVICE_ROLE_KEY (auto)
   - RESEND_API_KEY (must set manually)
   - EMAIL_FROM (must set manually)
   - PUBLIC_SITE_URL (optional, for custom domain)

### Testing Checklist

- [ ] 1. Submit access request with test email
  - Check browser console for "[RequestAccess] build source" and function logs
  - Check Supabase Function logs for "[request-access]" messages

- [ ] 2. Admin logs in and views Access Requests panel
  - Check console for "[AdminAccessRequests] build source" and function logs
  - Verify pending tab shows count > 0
  - Verify table displays submitted request

- [ ] 3. Admin clicks Approve button
  - Check console for "[AdminAccessRequests] invoking approve action"
  - Check Supabase Function logs for "[admin-access-requests] approving request"
  - Verify status changes to "approved" in response

- [ ] 4. Verify email sending (if RESEND_API_KEY configured)
  - Check console for send-invitation logs
  - Check spam folder for invitation email
  - Verify invitation link in email

- [ ] 5. Verify database updates
  - Check teacher_access_requests: status should be "invited"
  - Check teacher_invitation_tokens: token should be created
  - Check profiles: teacher account should be created with role="teacher"

### Console Log Format
All logs use format: [FUNCTION_NAME] message: details
- [RequestAccess] - Frontend access request form
- [AdminAccessRequests] - Frontend admin panel
- [request-access] - Edge Function for submissions
- [admin-access-requests] - Edge Function for admin operations
- [send-invitation] - Edge Function for email sending

### Common Issues & Solutions

1. **Requests not appearing in admin panel**
   - Check browser console for "[AdminAccessRequests]" logs
   - Check Supabase Function logs for "[admin-access-requests]" errors
   - Verify teacher_access_requests table exists and has data
   - Verify RLS SELECT policy allows admin to read

2. **Approve button not working**
   - Check browser console for approval action logs
   - Check admin-access-requests function logs
   - Verify request status is "pending"
   - Verify admin is authenticated with role="admin"

3. **Email not sending**
   - Check send-invitation function logs
   - Verify RESEND_API_KEY is set in Supabase Secrets
   - Verify EMAIL_FROM is valid
   - Check /spam folder for emails
   - Check Resend dashboard for error logs

4. **403 Stale session errors**
   - Fixed in supabaseClient.js with cleanupStaleUrlSession()
   - Stale tokens are now automatically removed from URL

5. **422 Unprocessable Entity errors**
   - Fixed in supabaseClient.js with graceful admin client handling
   - Missing VITE_SUPABASE_SERVICE_ROLE_KEY now shows clear error

### Deployment Status
- ✅ request-access function deployed
- ✅ admin-access-requests function deployed (v2 with enhanced logging)
- ✅ send-invitation function deployed
- ✅ App rebuilt with stale session handling
- ✅ App rebuilt with better error handling

### Next Actions
1. Test the workflow end-to-end
2. Monitor console and function logs for any issues
3. Verify database records are being created correctly
4. Ensure email sending works with RESEND_API_KEY

