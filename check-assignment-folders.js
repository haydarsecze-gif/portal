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
    console.log('Searching for folders named "DSAAS" in Google Drive...');
    const response = await drive.files.list({
      q: "name = 'DSAAS' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name, parents, owners, capabilities)',
    });
    
    const files = response.data.files;
    console.log(`Found ${files.length} folder(s):`);
    for (const f of files) {
      console.log(`- Folder Name: "${f.name}"`);
      console.log(`  ID: ${f.id}`);
      console.log(`  Parents:`, f.parents);
      console.log(`  Owners:`, f.owners?.map(o => o.emailAddress));
      console.log(`  Capabilities (canAddChildren):`, f.capabilities?.canAddChildren);
    }
  } catch (error) {
    console.error('Error listing/searching assignment folders:', error.message);
  }
}

run();
