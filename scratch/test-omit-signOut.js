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

// Polyfill localStorage for node environment to simulate browser client
const localStorageMock = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, value) { this.store[key] = String(value); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};
global.localStorage = localStorageMock;

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'sb-aqvpwhubbytjzcdsfvhc-auth-token',
  },
  global: {
    fetch: (url, options) => {
      // Simulate browser credentials: omit
      const newOptions = {
        ...options,
        credentials: 'omit'
      };
      return fetch(url, newOptions);
    }
  }
});

async function run() {
  const email = 'godchan22@gmail.com';
  const password = 'password123';
  
  console.log('1. Logging in...');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('Sign-in failed:', error.message);
    return;
  }
  console.log('Sign-in Succeeded! User:', data.user.email);
  
  console.log('2. Signing out...');
  const { error: outError } = await supabase.auth.signOut();
  if (outError) {
    console.error('Sign-out failed:', outError.message);
  } else {
    console.log('Sign-out Succeeded!');
  }
}

run();
