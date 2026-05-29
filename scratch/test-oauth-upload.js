const { google } = require('googleapis');
const { loadEnvConfig } = require('@next/env');
const { Readable } = require('stream');

loadEnvConfig(process.cwd());

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
const folderId = '1hjYKKzsQxBQWrLJowF9iPBeXhMESQt65'; // assignment:dsaas folder ID

async function run() {
  console.log('Testing Google Drive API authentication using OAuth2 Refresh Token...');
  console.log(`Client ID: ${clientId ? 'Present' : 'Missing'}`);
  console.log(`Client Secret: ${clientSecret ? 'Present' : 'Missing'}`);
  console.log(`Refresh Token: ${refreshToken ? 'Present' : 'Missing'}`);

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('Error: OAuth2 environment variables are missing from .env.local!');
    return;
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // 1. Get folder metadata
    console.log(`\nStep 1: Fetching metadata for folder ${folderId}...`);
    const info = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, owners, capabilities',
    });
    console.log(`Step 1 Success: Folder Name is "${info.data.name}"`);
    console.log(`Owners:`, info.data.owners?.map(o => o.emailAddress));
    console.log(`Capabilities: canAddChildren = ${info.data.capabilities?.canAddChildren}, canEdit = ${info.data.capabilities?.canEdit}`);

    // 2. Try creating a dummy student folder
    const studentName = "Test OAuth Student " + Date.now();
    console.log(`\nStep 2: Creating subfolder "${studentName}"...`);
    const folderRes = await drive.files.create({
      requestBody: {
        name: studentName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [folderId]
      },
      fields: 'id',
    });
    const subFolderId = folderRes.data.id;
    console.log(`Step 2 Success! Subfolder ID: ${subFolderId}`);

    // 3. Try uploading a test file inside that subfolder
    console.log(`\nStep 3: Uploading test file...`);
    const fileRes = await drive.files.create({
      requestBody: {
        name: 'test_oauth_submission.txt',
        parents: [subFolderId]
      },
      media: {
        mimeType: 'text/plain',
        body: Readable.from(['Hello World submission via OAuth2'])
      },
      fields: 'id, webViewLink, name',
    });
    console.log(`Step 3 Success! File ID: ${fileRes.data.id}, Link: ${fileRes.data.webViewLink}`);

    // 4. Try setting permission of the uploaded file to anyone reader
    console.log(`\nStep 4: Setting reader permission on uploaded file...`);
    await drive.permissions.create({
      fileId: fileRes.data.id,
      requestBody: { role: 'reader', type: 'anyone' }
    });
    console.log(`Step 4 Success! File is now accessible by anyone with the link.`);

    // 5. Clean up: trash the created test subfolder
    console.log(`\nStep 5: Cleaning up test subfolder...`);
    await drive.files.update({
      fileId: subFolderId,
      requestBody: { trashed: true }
    });
    console.log(`Step 5 Success! Test subfolder trashed.`);

  } catch (error) {
    console.error('ERROR during OAuth2 upload simulation:', error.message);
    if (error.errors) {
      console.error(JSON.stringify(error.errors, null, 2));
    }
  }
}

run();
