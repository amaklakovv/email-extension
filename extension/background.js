// This file is the extension's service worker and it runs in the background and handles events and long-running tasks
// Fetches the user's unread email message IDs from the Gmail API
async function fetchUnreadMessageIds(token) {
  console.log('Fetching unread emails...');
  try {
    // The 'q' parameter filters for unread messages. We also limit to 5 for now to keep it simple
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

    // The next step will be to take these IDs and fetch the full content for each one
  } catch (error) {
    console.error('Error fetching emails:', error);
  }
}

// Initiates the Google OAuth2 flow to get a token
// The 'interactive: true' flag will prompt the user to login and grant permissions if they haven't already
function getAuthToken() {
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    if (chrome.runtime.lastError) {
      console.error('getAuthToken error:', chrome.runtime.lastError.message);
      return;
    }
    console.log('Successfully received auth token:', token);
    // Now that we have the token, let's use it to fetch the list of unread emails
    fetchUnreadMessageIds(token);
  });
}

// Listen for messages from other parts of the extension, like the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'login') {
    getAuthToken();
  }
  // Return true to indicate you wish to send a response asynchronously
  return true;
});