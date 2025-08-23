document.addEventListener('DOMContentLoaded', () => {
  const loginButton = document.getElementById('login-button');
  const summaryContainer = document.getElementById('summary-container');
  const summaryContent = document.getElementById('summary-content');
  const replyContent = document.getElementById('reply-content');
  const statusMessage = document.getElementById('status-message');

  // Try to get the summary from storage when the popup opens
  chrome.storage.session.get(['lastSummary'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error retrieving from storage:', chrome.runtime.lastError);
      statusMessage.textContent = 'Error loading data.';
      return;
    }

    if (result.lastSummary) {
      summaryContainer.style.display = 'block';
      summaryContent.textContent = result.lastSummary.summary;
      replyContent.textContent = result.lastSummary.reply_draft;
      loginButton.style.display = 'none'; // Hide login button if we have data
    } else {
      statusMessage.textContent = 'No summary available. Click login to fetch emails.';
    }
  });

  loginButton.addEventListener('click', () => {
    // Send a message to the background script to start the auth flow
    chrome.runtime.sendMessage({ action: 'login' });
    statusMessage.textContent = 'Fetching emails... Please reopen the popup in a moment.';
    // We don't close the window immediately so the user can see the status message
    setTimeout(() => window.close(), 2000);
  });
});
