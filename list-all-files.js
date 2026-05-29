const fs = require('fs');
const { google } = require('googleapis');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const rawKey = process.env.GOOGLE_PRIVATE_KEY;
let formattedKey = rawKey;
if (formattedKey && (formattedKey.startsWith("'") || formattedKey.startsWith('"'))) {
  formattedKey = formattedKey.substring(1, formattedKey.length - 1);
}
formattedKey = formattedKey?.replace(/\\n/g, '\n');

const auth = new google.auth.JWT({
  email: email,
  key: formattedKey,
  scopes: ['https://www.googleapis.com/auth/drive']
});

const drive = google.drive({ version: 'v3', auth });

async function run() {
  try {
    console.log('Listing ALL files/folders accessible to the Service Account...');
    const response = await drive.files.list({
      pageSize: 50,
      fields: 'files(id, name, mimeType, parents, owners)',
    });
    
    const files = response.data.files;
    console.log(`Found ${files.length} file(s)/folder(s):`);
    for (const f of files) {
      console.log(`- "${f.name}" (${f.mimeType}) ID: ${f.id} Parents: ${f.parents}`);
    }
  } catch (error) {
    console.error('Error listing files:', error.message);
  }
}

run();
