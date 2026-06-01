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
  const studentFolderId = '1krsfgDtN6UAr4Tftch0QvxndVZIMVikG';
  
  console.log(`=== LISTING FOLDERS/FILES UNDER STUDENT FOLDER: ${studentFolderId} ===`);
  const studentFiles = await drive.files.list({
    q: `'${studentFolderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  console.log(JSON.stringify(studentFiles.data.files, null, 2));

  // Find resubmit folders
  const resubmitFolders = studentFiles.data.files.filter(f => f.mimeType === 'application/vnd.google-apps.folder' && f.name.includes('TEST'));
  for (const folder of resubmitFolders) {
    console.log(`\n=== LISTING FILES UNDER RESUBMIT FOLDER: "${folder.name}" (${folder.id}) ===`);
    const subFiles = await drive.files.list({
      q: `'${folder.id}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    console.log(JSON.stringify(subFiles.data.files, null, 2));
  }
}

run().catch(console.error);
