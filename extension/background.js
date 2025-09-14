import { MOCK_SUMMARIES, useMockData } from './mockdata.js';

// MOCK DATA FOR DEVELOPMENT
// Set to `true` to use mock data and bypass Google login and backend calls
// Set to `false` for production or to test with real data
const USE_MOCK_DATA = true;

// Decodes a Base64-encoded string that is safe for URLs
// Gmail API returns body content in this format
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  return atob(str);
}

// Fetches the full content of a single email message and returns its details
async function fetchMessageDetails(token, messageId) {
  console.log(`Fetching details for message ID: ${messageId}`);
  const response = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
    headers: { 'Authorization': `Bearer ${token}` },
    cache: 'no-cache'
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
    // Get user-defined maxResults from storage, with a default of 5
    const { summarizedMessageIds = [] } = await chrome.storage.local.get('summarizedMessageIds');
    const { summariesList: oldSummaries = [] } = await chrome.storage.session.get('summariesList');

    const { maxEmails } = await chrome.storage.sync.get({ maxEmails: 5 });
    console.log(`Using maxResults: ${maxEmails}`);

    // The 'q' parameter filters for unread messages, limited by the user's setting
    const response = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=${maxEmails}`, {
      cache: 'no-cache',
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

    const allUnreadMessages = data.messages || [];
    // Filter out messages that have already been summarized
    const newMessagesToProcess = allUnreadMessages.filter(msg => !summarizedMessageIds.includes(msg.id));

    if (newMessagesToProcess.length > 0) {
      console.log(`Found ${newMessagesToProcess.length} new unread emails to summarize.`);
      const detailPromises = newMessagesToProcess.map(message => fetchMessageDetails(token, message.id));
      const emailDetails = await Promise.all(detailPromises);
      const newSummaries = await summarizeEmailsWithBackend(emailDetails);

      // Combine new summaries with existing ones and update storage
      const allSummaries = [...newSummaries, ...oldSummaries];
      const newSummarizedIds = [...summarizedMessageIds, ...newSummaries.map(s => s.messageId)];

      await chrome.storage.session.set({ summariesList: allSummaries });
      await chrome.storage.local.set({ summarizedMessageIds: newSummarizedIds });
      await chrome.action.setBadgeText({ text: allSummaries.length > 0 ? String(allSummaries.length) : '' });

    } else {
      console.log('No new unread emails found.');
      // If there are no new messages, ensure the session is still set correctly
      // in case it was cleared, but don't overwrite if it has data.
      if (!oldSummaries.length) await chrome.storage.session.set({ summariesList: [] });
    }
  } catch (error) {
    console.error('Error during fetch/summarize process:', error);
    // Clear storage on any error to ensure a clean state for the next attempt
    await chrome.storage.session.remove('summariesList');
  } finally {
    // ALWAYS notify the popup that the process is complete, so it can update its UI
    console.log('Process finished, notifying popup.');
    chrome.runtime.sendMessage({ action: 'summariesUpdated' }, () => {
      if (chrome.runtime.lastError) {
        console.log('Popup not open. State saved. Update on next open');
      }
    });
  }
}

// Initiates the Google OAuth2 flow to get a token
function getAuthToken(isInteractive, callback) {
  if (USE_MOCK_DATA) {
    useMockData();
    return;
  }

  chrome.identity.getAuthToken({ interactive: isInteractive }, (token) => {
    if (chrome.runtime.lastError || !token) {
      // If it's non-interactive stop silently
      if (!isInteractive) {
        console.log('Could not get token non-interactively. User may be logged out.');
        // If a callback was provided, call it with no token
        if (callback) {
          callback(null);
        }
        return;
      }
      // If interactive it means the user cancelled the dialog
      console.log('getAuthToken interactive error/rejection:', chrome.runtime.lastError.message);
      chrome.runtime.sendMessage({ action: 'summariesUpdated' }, () => {
        if (chrome.runtime.lastError) {
          console.log('Popup not open when auth failed/cancelled.');
        }
      });
      return;
    }
    console.log('Successfully received auth token:', token);
    // If a callback is provided, use it. Otherwise, do the default action.
    if (callback) {
      callback(token);
    } else {
      fetchUnreadMessageIds(token);
    }
  });
}

// Logout process where it removes token and clears session data
async function handleLogout() {
  console.log('Handling logout request...');
  try {
    const token = await new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => resolve(token));
    });

    if (token) {
      await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
      await new Promise(resolve => chrome.identity.removeCachedAuthToken({ token }, resolve));
      console.log('Cached auth token removed.');
    }

    await chrome.storage.session.remove('summariesList');
    await chrome.storage.local.remove('summarizedMessageIds');
    await chrome.action.setBadgeText({ text: '' });
    console.log('Session and local storage cleared.');
  } catch (error) {
    console.error('Error during logout:', error);
  } finally {
    // Always notify the popup to update its UI
    chrome.runtime.sendMessage({ action: 'summariesUpdated' }, () => {
      if (chrome.runtime.lastError) {
        console.log('Popup not open during logout. State cleared.');
      }
    });
  }
}

// Used when the extension is first installed, updated, or Chrome is updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated. Setting up alarm.');
  // 1 minute delay for initial fetch after install/update for better UX
  // 15 minutes period for subsequent fetches
  chrome.alarms.create('fetchEmailsAlarm', {
    delayInMinutes: 1,
    periodInMinutes: 15
  });
  chrome.action.setBadgeBackgroundColor({ color: '#F44336' });
});

// Used when an alarm goes off
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'fetchEmailsAlarm') {
    console.log('Alarm triggered: fetching emails in the background.');
    // Fetch non-interactively and it will fail silently if the user is logged out
    getAuthToken(false);
  }
});

// Listen for messages from other parts of the extension like the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'login') {
    getAuthToken(true);
  } else if (request.action === 'logout') {
    handleLogout();
  } else if (request.action === 'summarizeSingleEmail') {
    const { messageId } = request;
    const tabId = sender.tab.id;
    console.log(`Content script requested summary for messageId: ${messageId}`);

      // So I can test without using my api key
      if (USE_MOCK_DATA) {
        console.log('HANDLING SINGLE EMAIL WITH MOCK DATA');
        setTimeout(() => {
            const mockSummary = MOCK_SUMMARIES[Math.floor(Math.random() * MOCK_SUMMARIES.length)];
            const responseData = { ...mockSummary, messageId, subject: 'Mocked: ' + mockSummary.subject };
            chrome.tabs.sendMessage(tabId, { action: 'showSummary', data: responseData });
        }, 1500);
      } else {
        getAuthToken(false, async (token) => {
          if (!token) {
            chrome.tabs.sendMessage(tabId, { action: 'error', message: 'Could not authenticate. Please log in via the extension popup.' });
            return;
          }
          try {
            const emailDetails = await fetchMessageDetails(token, messageId);
            const summaries = await summarizeEmailsWithBackend([emailDetails]);
            chrome.tabs.sendMessage(tabId, { action: 'showSummary', data: summaries[0] });
          } catch (error) {
            console.error('Error summarizing single email:', error);
            chrome.tabs.sendMessage(tabId, { action: 'error', message: 'Failed to generate summary.' });
          }
        });
      }
      return true; // Indicate that we will respond asynchronously.
  }
});

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

  return combinedData;
}