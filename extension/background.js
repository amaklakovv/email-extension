// This file is the extension's service worker and it runs in the background and handles events and long-running tasks

// MOCK DATA FOR DEVELOPMENT
// Set to `true` to use mock data and bypass Google login and backend calls
// Set to `false` for production or to test with real data
const USE_MOCK_DATA = true;

const MOCK_SUMMARIES = [
  {
    messageId: 'mock123abc',
    subject: 'Mock Email: Project Update',
    sender: 'team@example.com',
    summary: 'This is a mock summary for the project update. We are on track to meet the Q3 deadline. All major components are integrated and passing initial tests.',
    reply_draft: 'Thanks for the update! Glad to hear we are on track. Let me know if the design team can help with anything.'
  },
  {
    messageId: 'mock456def',
    subject: 'Re: Your recent order',
    sender: 'support@example.com',
    summary: 'A mock summary regarding your recent order. It has been shipped via Express Courier and is expected to arrive in 2-3 business days.',
    reply_draft: 'Thank you for letting me know. I look forward to receiving it.'
  }
];

// END MOCK DATA

// Decodes a Base64-encoded string that is safe for URLs
// Gmail API returns body content in this format
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  return atob(str);
}

// Sends email data to the backend API for summarisation
async function summarizeEmailsWithBackend(emailsData) {
  console.log(`Sending ${emailsData.length} email(s) to backend for summarisation...`);
  const response = await fetch('http://127.0.0.1:8000/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emailsData),
  });

  if (!response.ok) throw new Error(`Backend responded with ${response.status}: ${await response.text()}`);

  const summaries = await response.json();
  console.log('SUCCESS: Received summaries from backend:', summaries);

  // Combine original email details with the summaries received from the backend
  const combinedData = emailsData.map((email, index) => ({
    messageId: email.messageId,
    subject: email.subject,
    sender: email.sender,
    summary: summaries[index].summary,
    reply_draft: summaries[index].reply_draft,
  }));

  // Store the list of summaries so the popup can access it
  await chrome.storage.session.set({ summariesList: combinedData });
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

  return { messageId, subject, sender, body };
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
      // If token is invalid (401), we should try to remove it before the next attempt
      if (response.status === 401) {
        console.log('Auth token invalid, removing cached token.');
        await new Promise(resolve => chrome.identity.removeCachedAuthToken({ token }, resolve));
      }
      throw new Error(`Gmail API responded with ${response.status}: ${errorData.error.message}`);
    }

    const data = await response.json();
    console.log('API response for message IDs:', data);

    if (data.messages && data.messages.length > 0) {
      const detailPromises = data.messages.map(message => fetchMessageDetails(token, message.id));
      const emailDetails = await Promise.all(detailPromises);
      await summarizeEmailsWithBackend(emailDetails);
    } else {
      console.log('No unread emails found.');
      await chrome.storage.session.set({ summariesList: [] }); // Store empty array for popup
    }
  } catch (error) {
    console.error('Error during fetch/summarize process:', error);
    // Clear storage on any error to ensure a clean state for the next attempt
    await chrome.storage.session.remove('summariesList');
  } finally {
    // ALWAYS notify the popup that the process is complete, so it can update its UI.
    console.log('Process finished, notifying popup.');
    chrome.runtime.sendMessage({ action: 'summariesUpdated' });
  }
}

// Injects mock data for development purposes bypassing the real API calls
async function useMockData() {
  console.log('USING MOCK DATA');
  // Simulate network delay to show the loading spinner in the popup
  await new Promise(resolve => setTimeout(resolve, 1000));

  await chrome.storage.session.set({ summariesList: MOCK_SUMMARIES });
  console.log('Mock summaries stored. Notifying popup.');
  chrome.runtime.sendMessage({ action: 'summariesUpdated' });
}

// Initiates the Google OAuth2 flow to get a token
function getAuthToken() {
  if (USE_MOCK_DATA) {
    useMockData();
    return;
  }

  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    if (chrome.runtime.lastError || !token) {
      console.error('getAuthToken error:', chrome.runtime.lastError.message);
      // If user cancels the auth dialog, notify the popup to stop the loading state.
      chrome.runtime.sendMessage({ action: 'summariesUpdated' });
      return;
    }
    console.log('Successfully received auth token:', token);
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