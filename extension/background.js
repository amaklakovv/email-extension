// This file is the extension's service worker and it runs in the background and handles events and long-running tasks

// Decodes a Base64-encoded string that is safe for URLs
// Gmail API returns body content in this format
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  return atob(str);
}

// Sends email data to the backend API for summarisation
async function summarizeEmailsWithBackend(emailsData) {
  console.log(`Sending ${emailsData.length} email(s) to backend for summarisation...`);
  try {
    const response = await fetch('http://127.0.0.1:8000/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailsData),
    });

    if (!response.ok) throw new Error(`Backend responded with ${response.status}: ${await response.text()}`);

    const summaries = await response.json();
    console.log('SUCCESS: Received summaries from backend:', summaries);
    // Store the list of summaries so the popup can access it
    await chrome.storage.session.set({ summariesList: summaries });
  } catch (error) {
    console.error('ERROR: Could not summarise emails:', error);
    await chrome.storage.session.remove('summariesList');
  }
}

// Fetches the full content of a single email message and returns its details
async function fetchMessageDetails(token, messageId) {
  console.log(`Fetching details for message ID: ${messageId}`);
  const response = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const message = await response.json();

  // Extract key information from the complex message object
  const headers = message.payload.headers;
  const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || 'No Subject';
  const sender = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';

  // The body is often in parts so this looks for the plain text version
  const textPart = message.payload.parts?.find(p => p.mimeType === 'text/plain');
  const bodyData = textPart?.body?.data || message.payload.body?.data || '';
  const body = bodyData ? base64UrlDecode(bodyData) : 'No Body';

  return { subject, sender, body };
}

// Fetches the user's unread email message IDs from the Gmail API
async function fetchUnreadMessageIds(token) {
  console.log('Fetching unread emails...');
  try {
    // The 'q' parameter filters for unread messages limited to 5 for now
    const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=5', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gmail API responded with ${response.status}: ${errorData.error.message}`);
    }

    const data = await response.json();
    console.log('API response for message IDs:', data);

    if (data.messages && data.messages.length > 0) {
      // Fetch details for all messages concurrently
      const detailPromises = data.messages.map(message => fetchMessageDetails(token, message.id));
      const emailDetails = await Promise.all(detailPromises);

      // Now send the collected details to the backend in one batch
      await summarizeEmailsWithBackend(emailDetails);
    } else {
      console.log('No unread emails found.');
      await chrome.storage.session.set({ summariesList: [] }); // Store empty array for popup
    }
  } catch (error) {
    console.error('Error fetching emails:', error);
  }
}

// Initiates the Google OAuth2 flow to get a token
function getAuthToken() {
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    if (chrome.runtime.lastError) {
      console.error('getAuthToken error:', chrome.runtime.lastError.message);
      return;
    }
    console.log('Successfully received auth token:', token);
    // Now that we have the token we can use it to fetch the list of unread emails
    fetchUnreadMessageIds(token);
  });
}

// Listen for messages from other parts of the extension like the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'login') {
    getAuthToken();
  }
  // Return true to indicate you wish to send a response asynchronously
  return true;
});