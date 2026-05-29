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
    const folderId = '1hjYKKzsQxBQWrLJowF9iPBeXhMESQt65'; // assignment:dsaas folder ID
    console.log(`Checking permissions and capabilities of folder ID: ${folderId}...`);
    
    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, capabilities, owners, permissions',
    });
    
    console.log('Folder Name:', response.data.name);
    console.log('Owners:', response.data.owners?.map(o => o.emailAddress));
    console.log('Capabilities (canAddChildren):', response.data.capabilities?.canAddChildren);
    console.log('Capabilities (canEdit):', response.data.capabilities?.canEdit);
    console.log('Permissions:', response.data.permissions);
  } catch (error) {
    console.error('Error fetching folder metadata:', error.message);
  }
}

run();
