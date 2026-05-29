const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Fetching assignment details...');
  const { data: assignments, error } = await supabase.from('assignments').select('*');
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log(JSON.stringify(assignments, null, 2));
  }
}

run();
