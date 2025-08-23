document.addEventListener('DOMContentLoaded', () => {
  const loginButton = document.getElementById('login-button');
  const summariesContainer = document.getElementById('summaries-container');
  const statusMessage = document.getElementById('status-message');

  // Try to get the list of summaries from storage when the popup opens
  chrome.storage.session.get(['summariesList'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error retrieving from storage:', chrome.runtime.lastError);
      statusMessage.textContent = 'Error loading data.';
      return;
    }

    const summaries = result.summariesList;

    if (summaries && summaries.length > 0) {
      loginButton.style.display = 'none'; // Hide login button if we have data
      statusMessage.textContent = '';

      summaries.forEach(item => {
        const summaryItem = document.createElement('div');
        summaryItem.className = 'summary-item';

        const summaryTitle = document.createElement('h2');
        summaryTitle.textContent = 'Summary';
        const summaryContent = document.createElement('p');
        summaryContent.textContent = item.summary;

        const replyTitle = document.createElement('h2');
        replyTitle.textContent = 'Draft Reply';
        const replyContent = document.createElement('p');
        replyContent.textContent = item.reply_draft;

        summaryItem.appendChild(summaryTitle);
        summaryItem.appendChild(summaryContent);
        summaryItem.appendChild(replyTitle);
        summaryItem.appendChild(replyContent);
        summariesContainer.appendChild(summaryItem);
      });
    } else if (summaries) { // It's an empty array
      statusMessage.textContent = 'Inbox zero! No unread emails to summarise.';
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
