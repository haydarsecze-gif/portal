const { google } = require('googleapis');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
const folderId = '1hjYKKzsQxBQWrLJowF9iPBeXhMESQt65'; // assignment:dsaas folder ID

async function run() {
  console.log('Testing Direct Client-to-Drive upload protocol simulator...');
  
  try {
    // 1. SIMULATE SERVER GETTING ACCESS TOKEN
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { token: accessToken } = await oauth2Client.getAccessToken();
    console.log('Step 1: Access Token acquired successfully from Google OAuth2.');

    // 2. SIMULATE SERVER CREATING STUDENT SUBFOLDER
    console.log('\nStep 2: Simulating server creating/retrieving student folder...');
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const studentFolderName = "Direct Client Student " + Date.now();
    const folderRes = await drive.files.create({
      requestBody: {
        name: studentFolderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [folderId]
      },
      fields: 'id',
    });
    const studentFolderId = folderRes.data.id;
    console.log(`Student Folder created with ID: ${studentFolderId}`);

    // 3. SIMULATE CLIENT DIRECT UPLOAD VIA FETCH
    console.log('\nStep 3: Simulating client uploading file directly to Google Drive via fetch multipart...');
    const fileName = 'test_direct_upload.txt';
    const fileContent = 'This is a direct client-to-drive multipart upload simulation!';
    
    // Construct multipart form data body manually to simulate browser FormData
    const metadata = {
      name: fileName,
      parents: [studentFolderId]
    };

    // We can use standard FormData if we require, but in Node we can simulate it using fetch or form-data
    // Since fetch is native in Node 18+, let's construct standard FormData
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([fileContent], { type: 'text/plain' }));

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: form
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Upload failed (Status ${uploadRes.status}): ${errText}`);
    }

    const uploadData = await uploadRes.json();
    const fileId = uploadData.id;
    console.log(`Step 3 Success! File uploaded directly. File ID: ${fileId}`);

    // 4. SIMULATE CLIENT CREATING PERMISSION VIA FETCH
    console.log('\nStep 4: Simulating client setting permission to anyone reader via fetch...');
    const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });

    if (!permRes.ok) {
      const errText = await permRes.text();
      throw new Error(`Permission set failed (Status ${permRes.status}): ${errText}`);
    }

    console.log('Step 4 Success! File is now shared with anyone.');

    // 5. GET THE FILE WEB VIEW LINK VIA FETCH
    console.log('\nStep 5: Retrieving file webViewLink...');
    const getRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink,name`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!getRes.ok) {
      const errText = await getRes.text();
      throw new Error(`Failed to retrieve file metadata: ${errText}`);
    }

    const fileMeta = await getRes.json();
    console.log(`Step 5 Success! File Name: ${fileMeta.name}, Link: ${fileMeta.webViewLink}`);

    // CLEANUP
    console.log('\nStep 6: Cleaning up subfolder...');
    await drive.files.update({
      fileId: studentFolderId,
      requestBody: { trashed: true }
    });
    console.log('Cleanup completed successfully.');

  } catch (error) {
    console.error('ERROR during simulation:', error.message);
  }
}

run();
