const { google } = require('googleapis');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
const folderId = '1hjYKKzsQxBQWrLJowF9iPBeXhMESQt65'; // assignment:dsaas folder ID

async function run() {
  console.log('Testing Resumable Chunked Google Drive Upload Protocol Simulator...');
  
  try {
    // 1. GET ACCESS TOKEN
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { token: accessToken } = await oauth2Client.getAccessToken();
    console.log('Step 1: Access Token acquired successfully.');

    // 2. INITIATE RESUMABLE UPLOAD SESSION WITH METADATA
    console.log('\nStep 2: Initiating resumable upload session on Google Drive...');
    const fileName = 'test_resumable_mp4_simulation.mp4';
    const fileMime = 'video/mp4';
    
    // We will simulate a 12MB video file
    const totalBytes = 12 * 1024 * 1024; // 12,582,912 bytes
    
    const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': fileMime,
        'X-Upload-Content-Length': String(totalBytes)
      },
      body: JSON.stringify({
        name: fileName,
        parents: [folderId]
      })
    });

    if (!initRes.ok) {
      const errText = await initRes.text();
      throw new Error(`Initiation failed (Status ${initRes.status}): ${errText}`);
    }

    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) {
      throw new Error('Google did not return an upload Location URI!');
    }
    console.log(`Step 2 Success! Upload Session URL acquired: \n${uploadUrl.substring(0, 100)}...`);

    // 3. UPLOAD CHUNKS SEQUENTIALLY
    console.log('\nStep 3: Simulating chunked streaming...');
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks (5,242,880 bytes)
    let uploadedBytes = 0;

    // Create a mock 5MB buffer of random data to simulate video file parts
    const mock5MBBuffer = Buffer.alloc(CHUNK_SIZE, 'a');

    while (uploadedBytes < totalBytes) {
      const chunkEnd = Math.min(uploadedBytes + CHUNK_SIZE, totalBytes);
      const currentChunkSize = chunkEnd - uploadedBytes;
      
      // Slicing simulated buffer
      const currentChunkBuffer = currentChunkSize === CHUNK_SIZE ? mock5MBBuffer : Buffer.alloc(currentChunkSize, 'b');

      console.log(`Uploading chunk: Bytes ${uploadedBytes}-${chunkEnd - 1}/${totalBytes} (${currentChunkSize} bytes)...`);

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(currentChunkSize),
          'Content-Range': `bytes ${uploadedBytes}-${chunkEnd - 1}/${totalBytes}`
        },
        body: currentChunkBuffer
      });

      if (uploadRes.status === 308) {
        console.log(`  Received status 308 (Resume Incomplete) - Chunk recorded!`);
        uploadedBytes = chunkEnd;
      } else if (uploadRes.ok) {
        const fileData = await uploadRes.json();
        const fileId = fileData.id;
        console.log(`\nStep 3 Success! Final chunk received. File successfully uploaded!`);
        console.log(`Google File ID: ${fileId}`);

        // 4. SET PERMISSIONS
        console.log('\nStep 4: Sharing file to anyone reader...');
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
        if (permRes.ok) {
          console.log('Step 4 Success! File permissions granted.');
        }

        // 5. FETCH METADATA
        const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink,name`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        const fileMeta = await metaRes.json();
        console.log(`\nStep 5 Success! Final Web Link: ${fileMeta.webViewLink}`);

        // CLEANUP
        console.log('\nStep 6: Cleaning up created file...');
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        await drive.files.update({
          fileId: fileId,
          requestBody: { trashed: true }
        });
        console.log('Cleanup successful.');

        uploadedBytes = totalBytes; // Terminate loop
      } else {
        const errText = await uploadRes.text();
        throw new Error(`Upload failed at byte ${uploadedBytes} (Status ${uploadRes.status}): ${errText}`);
      }
    }

  } catch (error) {
    console.error('ERROR during resumable upload simulation:', error.message);
  }
}

run();
