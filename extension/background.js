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
  },
  {
    messageId: 'mock789ghi',
    subject: 'Meeting Reminder',
    sender: 'team@example.com',
    summary: 'This is a mock summary for the meeting reminder. The meeting is scheduled for tomorrow at 10 AM to discuss the new marketing strategy.',
    reply_draft: 'Thanks for the reminder. I will be there.'
  },
  {
    messageId: 'mock101jkl',
    subject: 'Newsletter - October Edition',
    sender: 'newsletter@example.com',
    summary: 'This is a mock summary for the October newsletter. It contains the latest updates and articles from our team.',
    reply_draft: 'Thank you for the newsletter. I found the articles very informative.'
  },
  {
    messageId: 'mock202mno',
    subject: 'Invitation to Webinar',
    sender: 'team@example.com',
    summary: 'This is a mock summary for the webinar invitation. The webinar will cover the latest trends in the industry and is scheduled for next week.',
    reply_draft: 'Thank you for the invitation. I would like to attend the webinar.'
  },
  {
    messageId: 'mock303pqr',
    subject: 'Follow-up on Project X',
    sender: 'manager@example.com',
    summary: 'This is a mock summary for the follow-up email on Project X. We need to finalize the requirements by the end of the week.',
    reply_draft: 'Thanks for the update. I will make sure to have the requirements ready by Friday.'
  },
  {
    messageId: 'mock404stu',
    subject: 'Your Subscription is Expiring',
    sender: 'billing@example.com',
    summary: 'This is a mock summary for the subscription expiration notice. Your subscription will expire in 3 days.',
    reply_draft: 'Thank you for the reminder. I will renew my subscription soon.'
  },
  {
    messageId: 'mock505vwx',
    subject: 'Feedback Request',
    sender: 'customer@example.com',
    summary: 'This is a mock summary for the feedback request email. The customer is requesting feedback on their recent purchase.',
    reply_draft: 'Thank you for reaching out. I will provide feedback on my purchase shortly.'
  }
];

// END MOCK DATA

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

    if (data.messages && data.messages.length > 0) {
      const detailPromises = data.messages.map(message => fetchMessageDetails(token, message.id));
      const emailDetails = await Promise.all(detailPromises);
      await summarizeEmailsWithBackend(emailDetails, true);
    } else {
      console.log('No unread emails found.');
      await chrome.storage.session.set({ summariesList: [] }); // Store empty array for popup
      await chrome.action.setBadgeText({ text: '' }); // Clear badge
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

// Injects mock data for development purposes bypassing the real API calls
async function useMockData() {
  console.log('USING MOCK DATA');
  try {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get user-defined maxResults from storage, with a default of 5
    const { maxEmails } = await chrome.storage.sync.get({ maxEmails: 5 });
    console.log(`Using mock data with maxEmails: ${maxEmails}`);

    // Slice the mock data array to respect the user's setting
    const slicedMockData = MOCK_SUMMARIES.slice(0, maxEmails);

    await chrome.storage.session.set({ summariesList: slicedMockData });
    console.log('Mock summaries stored. Notifying popup.');

    // Update badge FOR MOCK DATA
    const count = slicedMockData.length;
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  } finally {
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
function handleLogout() {
  console.log('Handling logout request...');
  // First, try to get the current auth token so we can remove it
  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    if (chrome.runtime.lastError) {
      // This can happen if the user is already logged out so safe to ignore
      console.log('No active token found, clearing storage anyway.');
    }

    if (token) {
      // Invalidate the token on Google side
      fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
      // Remove the token from the browser's local cache
      chrome.identity.removeCachedAuthToken({ token }, () => {
        console.log('Cached auth token removed.');
      });
    }

    // Clear our extension's session storage and notify the popup
    chrome.storage.session.remove('summariesList', () => {
      chrome.action.setBadgeText({ text: '' });
      console.log('Session storage cleared. Notifying popup.');
      chrome.runtime.sendMessage({ action: 'summariesUpdated' }, () => {
        if (chrome.runtime.lastError) {
          console.log('Popup not open during logout. State cleared');
        }
      });
    });
  });
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
  // Set a default badge color
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

// Handles a request from a content script to summarize a single email
async function handleSummarizeSingleEmail(messageId, tabId) {
  console.log(`Content script requested summary for messageId: ${messageId}`);
  getAuthToken(false, async (token) => {
    if (!token) {
      console.error('Cannot summarize single email, no auth token.');
      // Optional to send an error message back to the content script
      chrome.tabs.sendMessage(tabId, { action: 'error', message: 'Could not authenticate. Please log in via the extension popup.' });
      return;
    }
    try {
      const emailDetails = await fetchMessageDetails(token, messageId, false);
      const summaries = await summarizeEmailsWithBackend([emailDetails], false);
      // Send single result back to the content script
      chrome.tabs.sendMessage(tabId, { action: 'showSummary', data: summaries[0] });
    } catch (error) {
      console.error('Error summarizing single email:', error);
      chrome.tabs.sendMessage(tabId, { action: 'error', message: 'Failed to generate summary.' });
    }
  });
}

// Listen for messages from other parts of the extension like the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'login') getAuthToken(true);
  else if (request.action === 'logout') handleLogout();
  else if (request.action === 'summarizeSingleEmail') {
    // Request from content script sender.tab.id tells us which tab to reply to
    handleSummarizeSingleEmail(request.messageId, sender.tab.id);
    return true;
  }
});

async function summarizeEmailsWithBackend(emailsData, storeInSession = true) {
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

  if (storeInSession) {
    // Store the list of summaries so the popup can access it
    await chrome.storage.session.set({ summariesList: combinedData });

    // Update the badge with the number of summaries
    const count = combinedData.length;
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  }

  return combinedData;
}