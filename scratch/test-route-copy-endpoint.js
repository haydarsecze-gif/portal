const fs = require('fs');

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

async function run() {
  const port = process.env.PORT || 3000;
  const url = `http://localhost:${port}/api/drive/upload`;
  
  console.log(`Sending POST request to ${url}...`);
  
  const payload = {
    studentName: "sam",
    targetFolderId: "1nAFxTLhuxT9lXXWBdc2WLlljJ4iaE2bO", // assignment folder
    fileName: "Screenshot_TEST_ROUTE_COPY.png",
    fileType: "image/png",
    fileSize: 100,
    isResubmission: true,
    resubmitFolderName: "resubmit - TEST ROUTINE VIA ENDPOINT",
    oldFileUrls: [
      "Screenshot 2026-06-01 at 10.09.53 in the morning.png:::https://drive.google.com/file/d/1wQ8mrLRCJddXYgU89geiBpdIg8ijP-ab/view?usp=drivesdk",
      "Screenshot 2026-06-01 at 10.10.00 in the morning.png:::https://drive.google.com/file/d/1JUR7cps1mXGh05zBrGUgFoBuozVljMMa/view?usp=drivesdk",
      "Screenshot_20260601-113648.png:::https://drive.google.com/file/d/1N7UNyEdWA1t-X0sfMJBNzZHQ1G-TYqOX/view?usp=drivesdk"
    ]
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    console.log("Response Status:", res.status);
    const data = await res.json();
    console.log("Response Body:", data);
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

run();
