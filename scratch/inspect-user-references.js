const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse environment variables safely
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

const targetUserId = 'a2ef2cbb-9312-4730-80e8-1a02e2701b81';

async function run() {
  try {
    console.log(`Scanning public schema for references to user ID: ${targetUserId}...`);
    
    // We can query the list of tables in public schema by fetching from pg_catalog if we had PG, 
    // but with Supabase client we can just query the known tables in the system!
    // What are the known tables?
    // Let's look at the database tables we know: profiles, notifications, students, classes, subjects, attendance, assignments, materials, submissions, student_classes
    const tables = [
      'profiles',
      'notifications',
      'students',
      'classes',
      'subjects',
      'attendance',
      'assignments',
      'materials',
      'submissions',
      'student_classes'
    ];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*');
        
        if (error) {
          console.warn(`Could not read table "${table}":`, error.message);
          continue;
        }
        
        if (!data || data.length === 0) continue;
        
        // Find if any field in any row matches the targetUserId
        const matchingRows = data.filter(row => {
          return Object.values(row).some(val => {
            if (typeof val === 'string' && val.toLowerCase() === targetUserId.toLowerCase()) {
              return true;
            }
            if (Array.isArray(val) && val.some(item => typeof item === 'string' && item.toLowerCase() === targetUserId.toLowerCase())) {
              return true;
            }
            return false;
          });
        });
        
        if (matchingRows.length > 0) {
          console.log(`!!! Found ${matchingRows.length} matches in table "${table}":`);
          console.log(matchingRows);
        } else {
          console.log(`Table "${table}": No matches.`);
        }
      } catch (e) {
        console.error(`Error scanning table "${table}":`, e.message);
      }
    }
    
    console.log('Scan completed!');
  } catch (error) {
    console.error('Error running scan:', error);
  }
}

run();
