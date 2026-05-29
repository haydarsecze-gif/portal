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
  const studentId = '66460f4e-56b8-4ca2-862c-f850804ff5db'; // sam
  const classId = '81c36a3d-b5b8-479d-881e-a4bb53c30ee2'; // Test Sub

  console.log('Updating sam\'s week 2 status to "Present" in database...');
  await supabase.from('attendance').update({ status: 'Present' }).eq('student_id', studentId).eq('class_id', classId).eq('week', 2);

  console.log('Querying admin_student_overview view...');
  const { data: viewData } = await supabase.from('admin_student_overview').select('*');
  console.log('Overview rows:', viewData);

  // Revert it back to 'P'
  console.log('Reverting sam\'s week 2 status back to "P"...');
  await supabase.from('attendance').update({ status: 'P' }).eq('student_id', studentId).eq('class_id', classId).eq('week', 2);
}

run();
