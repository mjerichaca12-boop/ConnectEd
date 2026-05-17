import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

export const config = {
  verify_jwt: false
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Extract connection details from environment
    const databaseUrl = Deno.env.get("DATABASE_URL");
    if (!databaseUrl) {
      return new Response(JSON.stringify({
        ok: false,
        error: "DATABASE_URL environment variable not set"
      }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Create direct postgres connection
    const client = new Client(databaseUrl);
    await client.connect();

    // Apply the request-table policies for both naming variants.
    const sql = `do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'teacher_request_access'
  ) then
    execute 'create policy if not exists teacher_request_access_select_admin on public.teacher_request_access for select to authenticated using ((select role from public.profiles where id = auth.uid()) = ''admin'')';
    execute 'create policy if not exists teacher_request_access_update_admin on public.teacher_request_access for update to authenticated using ((select role from public.profiles where id = auth.uid()) = ''admin'') with check ((select role from public.profiles where id = auth.uid()) = ''admin'')';
    execute 'create policy if not exists teacher_request_access_insert_public on public.teacher_request_access for insert to anon, authenticated with check (true)';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'teacher_access_requests'
  ) then
    execute 'create policy if not exists teacher_access_requests_select_admin on public.teacher_access_requests for select to authenticated using ((select role from public.profiles where id = auth.uid()) = ''admin'')';
    execute 'create policy if not exists teacher_access_requests_update_admin on public.teacher_access_requests for update to authenticated using ((select role from public.profiles where id = auth.uid()) = ''admin'') with check ((select role from public.profiles where id = auth.uid()) = ''admin'')';
    execute 'create policy if not exists teacher_access_requests_insert_public on public.teacher_access_requests for insert to anon, authenticated with check (true)';
  end if;
end $$;`;

    await client.queryArray(sql);
    await client.close();

    return new Response(JSON.stringify({
      ok: true,
      message: "Request table policies created successfully"
    }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (err) {
    console.error("Error applying policy:", err);
    return new Response(JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error"
    }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
