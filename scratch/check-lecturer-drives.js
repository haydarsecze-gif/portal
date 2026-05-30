const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local file
const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, drive_folder_id');

  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }

  console.log("=== LECTURER PROFILES IN DB ===");
  profiles.filter(p => p.role === 'teacher').forEach(p => {
    console.log(`ID: ${p.id}`);
    console.log(`Name: ${p.full_name}`);
    console.log(`Email: ${p.email}`);
    console.log(`Drive Folder ID: "${p.drive_folder_id}"`);
    console.log("------------------------");
  });
}

run();
