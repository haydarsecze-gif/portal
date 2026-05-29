const fs = require('fs');

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

async function run() {
  const res = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/', {
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY
    }
  });
  if (!res.ok) {
    console.error('Error fetching schema:', res.statusText);
    return;
  }
  const schema = await res.json();
  
  console.log('=== TABLES & VIEWS ===');
  console.log(Object.keys(schema.paths).filter(p => !p.startsWith('/rpc/')));
  
  console.log('=== RPC FUNCTIONS ===');
  console.log(Object.keys(schema.paths).filter(p => p.startsWith('/rpc/')));
}

run();
