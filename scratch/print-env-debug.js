const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

console.log("Loaded Env Variables:");
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);
console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "[PRESENT]" : "[MISSING]");
console.log("GOOGLE_REFRESH_TOKEN:", process.env.GOOGLE_REFRESH_TOKEN ? "[PRESENT]" : "[MISSING]");
