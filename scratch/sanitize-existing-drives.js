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

const extractFolderId = (input) => {
  if (!input) return '';
  const trimmed = input.trim();
  
  // Match typical google drive folder urls
  const foldersMatch = trimmed.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (foldersMatch && foldersMatch[1]) {
    return foldersMatch[1];
  }
  
  // Match open id urls
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }
  
  return trimmed;
}

async function run() {
  console.log('=== STARTING SANITIZATION ===');
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, drive_folder_id')
    .eq('role', 'teacher');

  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }

  for (const p of profiles) {
    if (!p.drive_folder_id) continue;
    const cleanId = extractFolderId(p.drive_folder_id);
    if (cleanId !== p.drive_folder_id) {
      console.log(`Sanitizing: ${p.full_name} (${p.id})`);
      console.log(`  Before: ${p.drive_folder_id}`);
      console.log(`  After:  ${cleanId}`);
      
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ drive_folder_id: cleanId })
        .eq('id', p.id);
        
      if (updateErr) {
        console.error(`Failed to update ${p.full_name}:`, updateErr.message);
      } else {
        console.log(`Successfully updated ${p.full_name}.`);
      }
    } else {
      console.log(`Already clean or valid ID for ${p.full_name}: ${p.drive_folder_id}`);
    }
  }
  console.log('=== SANITIZATION COMPLETE ===');
}

run();
