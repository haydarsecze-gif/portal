const fs = require('fs');
const { google } = require('googleapis');

const envContent = fs.readFileSync('./.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    value = value.trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.substring(1, value.length - 1);
    value = value.trim();
    env[match[1]] = value;
  }
});

const oauth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

async function run() {
  // We'll create a temporary test folder under the student folder (1XiD7MTFtErmx7b38MDajokjjT2s66NR6)
  const studentFolderId = '1XiD7MTFtErmx7b38MDajokjjT2s66NR6';
  const testFolderRes = await drive.files.create({
    requestBody: {
      name: 'resubmit - TEST COPY ROUTINE',
      mimeType: 'application/vnd.google-apps.folder',
      parents: [studentFolderId]
    },
    fields: 'id',
    supportsAllDrives: true
  });
  
  const testFolderId = testFolderRes.data.id;
  console.log(`Created test folder: ${testFolderId}`);

  const oldFileUrls = [
    "Screenshot 2026-06-01 at 10.09.53 in the morning.png:::https://drive.google.com/file/d/1wQ8mrLRCJddXYgU89geiBpdIg8ijP-ab/view?usp=drivesdk",
    "Screenshot 2026-06-01 at 10.10.00 in the morning.png:::https://drive.google.com/file/d/1JUR7cps1mXGh05zBrGUgFoBuozVljMMa/view?usp=drivesdk",
    "Screenshot_20260601-113648.png:::https://drive.google.com/file/d/1N7UNyEdWA1t-X0sfMJBNzZHQ1G-TYqOX/view?usp=drivesdk"
  ];

  function extractFileIdFromUrl(url) {
    const actualUrl = url.includes(':::') ? url.split(':::')[1] : url;
    const dMatch = actualUrl.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (dMatch && dMatch[1]) return dMatch[1];
    const idMatch = actualUrl.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (idMatch && idMatch[1]) return idMatch[1];
    return null;
  }

  for (const url of oldFileUrls) {
    const fileId = extractFileIdFromUrl(url);
    const originalName = url.includes(':::') ? url.split(':::')[0] : 'File';
    console.log(`\nAttempting to copy "${originalName}" (ID: ${fileId}) into ${testFolderId}...`);
    try {
      const copyRes = await drive.files.copy({
        fileId: fileId,
        requestBody: {
          name: originalName,
          parents: [testFolderId]
        },
        supportsAllDrives: true
      });
      console.log(`SUCCESS! Copied file ID: ${copyRes.data.id}`);
    } catch (err) {
      console.error(`ERROR copying file:`, err.message);
    }
  }

  // Clean up the test folder after the test
  console.log(`\nDeleting test folder ${testFolderId}...`);
  await drive.files.delete({
    fileId: testFolderId,
    supportsAllDrives: true
  });
  console.log('Cleanup complete.');
}

run().catch(console.error);
