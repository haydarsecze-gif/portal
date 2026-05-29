const { google } = require('googleapis');
const { loadEnvConfig } = require('@next/env');
const { Readable } = require('stream');

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

async function testFolder(folderId, label) {
  console.log(`\n=================== Testing folder ${label} (${folderId}) ===================`);
  try {
    // 1. Get folder metadata
    const info = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, owners, capabilities',
    });
    console.log(`Step 1 (Get Info) Success: Folder Name is "${info.data.name}"`);
    console.log(`Owners:`, info.data.owners?.map(o => o.emailAddress));
    console.log(`Capabilities: canAddChildren = ${info.data.capabilities?.canAddChildren}, canEdit = ${info.data.capabilities?.canEdit}`);

    // 2. Try listing children
    const listRes = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name)',
    });
    console.log(`Step 2 (List Children) Success: Found ${listRes.data.files?.length || 0} files/folders`);

    // 3. Try creating a dummy student folder
    const studentName = "Test Student " + Date.now();
    console.log(`Step 3 (Create Subfolder): Attempting to create folder "${studentName}"...`);
    const folderRes = await drive.files.create({
      requestBody: {
        name: studentName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [folderId]
      },
      fields: 'id',
    });
    const subFolderId = folderRes.data.id;
    console.log(`Step 3 Success! Subfolder ID: ${subFolderId}`);

    // 4. Try uploading a test file inside that subfolder
    console.log(`Step 4 (Upload File): Attempting to upload a test file...`);
    const fileRes = await drive.files.create({
      requestBody: {
        name: 'test_submission.txt',
        parents: [subFolderId]
      },
      media: {
        mimeType: 'text/plain',
        body: Readable.from(['Hello World submission test'])
      },
      fields: 'id, webViewLink, name',
    });
    console.log(`Step 4 Success! File ID: ${fileRes.data.id}, Link: ${fileRes.data.webViewLink}`);

    // 5. Try setting permission of the uploaded file to anyone reader
    console.log(`Step 5 (Set Permission): Setting reader permission on uploaded file...`);
    await drive.permissions.create({
      fileId: fileRes.data.id,
      requestBody: { role: 'reader', type: 'anyone' }
    });
    console.log(`Step 5 Success! File is now accessible by anyone with the link.`);

    // 6. Clean up: trash the created test subfolder
    console.log(`Step 6 (Cleanup): Trashing the test folder...`);
    await drive.files.update({
      fileId: subFolderId,
      requestBody: { trashed: true }
    });
    console.log(`Step 6 Success! Test subfolder trashed.`);

  } catch (error) {
    console.error(`ERROR on folder ${folderId}:`, error.message);
    if (error.errors) {
      console.error(JSON.stringify(error.errors, null, 2));
    }
  }
}

async function run() {
  const folders = [
    { id: '1hjYKKzsQxBQWrLJowF9iPBeXhMESQt65', label: 'dsaas' },
    { id: '1D3YH-8i9igHmDr1ccB61vwfJs0KKYS2I', label: 'fsdafas' },
    { id: '137YFyO3l72tK8jhMqqBBriZ8DaSte2jJ', label: 'asdfsdf' }
  ];

  for (const f of folders) {
    await testFolder(f.id, f.label);
  }
}

run();
