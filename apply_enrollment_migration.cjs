const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
CREATE OR REPLACE FUNCTION enroll_students_atomic(
  p_subject_id UUID,
  p_student_ids UUID[],
  p_teacher_id UUID,
  p_section TEXT
) RETURNS JSONB AS $$
DECLARE
  v_capacity INT;
  v_current_enrolled INT;
  v_available_slots INT;
  v_student_id UUID;
  v_inserted_count INT := 0;
  v_skipped_capacity INT := 0;
  v_already_enrolled INT := 0;
  v_res_enrolled_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  -- Row-level lock on subject row to prevent concurrent race conditions
  SELECT capacity INTO v_capacity
  FROM subjects
  WHERE id = p_subject_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class or subject not found.';
  END IF;

  SELECT COUNT(*) INTO v_current_enrolled
  FROM teacher_student_assignments
  WHERE subject_id = p_subject_id AND status = 'Active';

  v_available_slots := GREATEST(0, v_capacity - v_current_enrolled);

  IF v_available_slots <= 0 THEN
    RAISE EXCEPTION 'Cannot enroll student. This class has reached its maximum capacity of % students.', v_capacity;
  END IF;

  FOR i IN 1..array_length(p_student_ids, 1) LOOP
    v_student_id := p_student_ids[i];
    
    IF EXISTS (
      SELECT 1 FROM teacher_student_assignments 
      WHERE subject_id = p_subject_id AND student_id = v_student_id AND status = 'Active'
    ) THEN
      v_already_enrolled := v_already_enrolled + 1;
    ELSE
      IF v_inserted_count < v_available_slots THEN
        INSERT INTO teacher_student_assignments (teacher_id, student_id, subject_id, section, status)
        VALUES (p_teacher_id, v_student_id, p_subject_id, p_section, 'Active')
        ON CONFLICT DO NOTHING;
        
        v_inserted_count := v_inserted_count + 1;
        v_res_enrolled_ids := array_append(v_res_enrolled_ids, v_student_id);
      ELSE
        v_skipped_capacity := v_skipped_capacity + 1;
      END IF;
    END IF;
  END LOOP;

  -- Sync enrolled count in subjects table
  UPDATE subjects
  SET enrolled = (SELECT COUNT(*) FROM teacher_student_assignments WHERE subject_id = p_subject_id AND status = 'Active')
  WHERE id = p_subject_id;

  RETURN jsonb_build_object(
    'success', true,
    'enrolled_count', v_inserted_count,
    'skipped_capacity', v_skipped_capacity,
    'already_enrolled_count', v_already_enrolled,
    'new_total_enrolled', v_current_enrolled + v_inserted_count,
    'capacity', v_capacity
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function tryRpc(rpcName) {
  try {
    console.log(`Trying RPC '${rpcName}'...`);
    const { error } = await supabase.rpc(rpcName, { sql });
    if (!error) return true;
    console.log(`RPC '${rpcName}' failed:`, error.message);
  } catch (e) {
    console.log(`RPC '${rpcName}' error:`, e.message);
  }
  return false;
}

async function run() {
  const endpoints = ['exec', 'exec_sql', 'run_sql'];
  for (const name of endpoints) {
    if (await tryRpc(name)) {
      console.log(`✅ Success via RPC '${name}'`);
      process.exit(0);
    }
  }
  console.log('SQL to run in Supabase SQL Editor if RPC endpoint is not pre-exposed:\n' + sql);
}

run();
