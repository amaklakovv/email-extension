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

      // Clear any previous summaries before rendering new ones
      summariesContainer.innerHTML = '';
      summaries.forEach(item => renderSummaryItem(item));
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

  // Renders a single summary card with its content and copy buttons
  function renderSummaryItem(item) {
    const container = document.createElement('div');
    container.className = 'summary-item';

    // Clickable accordion header
    const header = document.createElement('button');
    header.className = 'summary-header';
    header.innerHTML = `<span class="summary-title">${item.subject}</span><span class="summary-sender">From: ${item.sender}</span>`;

    // Collapsible content
    const contentBody = document.createElement('div');
    contentBody.className = 'summary-content-body';

    const summaryTitle = document.createElement('h2');
    summaryTitle.textContent = 'Summary';
    const summaryContent = document.createElement('p');
    summaryContent.textContent = item.summary;
    const copySummaryButton = createCopyButton(item.summary, 'Copy Summary');

    const replyTitle = document.createElement('h2');
    replyTitle.textContent = 'Draft Reply';
    const replyContent = document.createElement('p');
    replyContent.textContent = item.reply_draft;
    const copyReplyButton = createCopyButton(item.reply_draft, 'Copy Reply');

    const viewOriginalButton = document.createElement('button');
    viewOriginalButton.textContent = 'View Original Email';
    viewOriginalButton.className = 'copy-button';
    viewOriginalButton.style.marginTop = '10px';
    viewOriginalButton.addEventListener('click', () => {
      const gmailUrl = `https://mail.google.com/mail/u/0/#inbox/${item.messageId}`;
      chrome.tabs.create({ url: gmailUrl });
    });

    contentBody.append(summaryTitle, summaryContent, copySummaryButton, replyTitle, replyContent, copyReplyButton, viewOriginalButton);

    //Click event to toggle visibility
    header.addEventListener('click', () => {
      header.classList.toggle('active');
      const isVisible = contentBody.style.display === 'block';
      contentBody.style.display = isVisible ? 'none' : 'block';
    });

    container.appendChild(header);
    container.appendChild(contentBody);
    summariesContainer.appendChild(container);
  }

  // Helper function to create a "Copy to Clipboard" button
  function createCopyButton(textToCopy, label = 'Copy') {
    const button = document.createElement('button');
    button.textContent = label;
    button.className = 'copy-button';
    button.addEventListener('click', () => {
      navigator.clipboard.writeText(textToCopy);
      button.textContent = 'Copied!';
      setTimeout(() => (button.textContent = label), 1500);
    });
    return button;
  }
});
