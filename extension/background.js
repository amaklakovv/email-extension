// This file is the extension's service worker. It runs in the background and handles events and long-running tasks.
// Initiates the Google OAuth2 flow to get a token.
// The 'interactive: true' flag will prompt the user to login and grant permissions if they haven't already
function getAuthToken() {
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    if (chrome.runtime.lastError) {
      console.error('getAuthToken error:', chrome.runtime.lastError.message);
      return;
    }
    // Will use this token to call the Gmail API later
    console.log('Successfully received auth token:', token);
  });
}

// Listen for messages from other parts of the extension, like the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'login') {
    getAuthToken();
  }
});