const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envPath = './.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function run() {
  console.log('--- Current Attendance State ---');
  const { data: rows } = await supabase.from('attendance').select('*');
  console.log(rows);

  console.log('\n--- Resetting accidental hidden_from_student overrides ---');
  for (const row of rows) {
    // Keep only SAM's Week 3 and Week 4 hidden
    const isSam = row.student_id === '66460f4e-56b8-4ca2-862c-f850804ff5db';
    const shouldKeepHidden = isSam && (row.week === 3 || row.week === 4);

    const { error } = await supabase
      .from('attendance')
      .update({ hidden_from_student: shouldKeepHidden })
      .eq('id', row.id);

    if (error) console.error(`Error updating row ${row.id}:`, error);
    else console.log(`Row ${row.id} updated: hidden_from_student = ${shouldKeepHidden}`);
  }

  console.log('\n--- Verification ---');
  const { data: verified } = await supabase.from('attendance').select('*');
  console.log(verified);
}

run();
