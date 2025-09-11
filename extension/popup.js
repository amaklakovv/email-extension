document.addEventListener('DOMContentLoaded', () => {
  const loginButton = document.getElementById('login-button');
  const summariesContainer = document.getElementById('summaries-container');
  const statusMessage = document.getElementById('status-message');
  const loader = document.getElementById('loader');
  const refreshButton = document.getElementById('refresh-button');
  const optionsButton = document.getElementById('options-button');
  
  // View containers and options elements
  const mainView = document.getElementById('main-view');
  const optionsView = document.getElementById('options-view');
  const backButtonHeader = document.getElementById('back-button-header');
  const saveButton = document.getElementById('save-button');
  const maxEmailsInput = document.getElementById('max-emails');
  const statusDiv = document.getElementById('status');

  // UI State Management

  function showLoadingState() {
    loginButton.style.display = 'none';
    refreshButton.style.display = 'none';
    summariesContainer.style.display = 'none';
    statusMessage.textContent = 'Fetching summaries...';
    loader.style.display = 'block';
  }

  function showLoginState() {
    loader.style.display = 'none';
    refreshButton.style.display = 'none';
    summariesContainer.innerHTML = '';
    summariesContainer.style.display = 'block';
    loginButton.style.display = 'block';
    statusMessage.textContent = 'Click login to fetch your unread emails.';
  }

  function showSummariesState(summaries) {
    loader.style.display = 'none';
    loginButton.style.display = 'none';
    refreshButton.style.display = 'block';
    statusMessage.textContent = '';
    summariesContainer.innerHTML = '';
    summariesContainer.style.display = 'block';

    if (summaries && summaries.length > 0) {
      summaries.forEach(item => renderSummaryItem(item));
    } else {
      statusMessage.textContent = 'Inbox zero! No unread emails to summarise.';
    }
  }

  // Main function to update the UI by reading from storage
  function updateUI() {
    chrome.storage.session.get(['summariesList'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error retrieving from storage:', chrome.runtime.lastError);
        statusMessage.textContent = 'Error loading data.';
        return;
      }

      const summaries = result.summariesList;
      if (summaries) { // This includes an empty array, meaning a successful fetch occurred
        showSummariesState(summaries);
      } else { // summaries is undefined/null, meaning we need to log in
        showLoginState();
      }
    });
  }

  // Event Listeners

  loginButton.addEventListener('click', () => {
    showLoadingState();
    // Send a message to the background script to start the auth flow
    chrome.runtime.sendMessage({ action: 'login' });
  });

  refreshButton.addEventListener('click', () => {
    showLoadingState();
    // Use the cached token if available and only prompt the user if needed
    chrome.runtime.sendMessage({ action: 'login' });
  });

  optionsButton.addEventListener('click', () => {
    mainView.style.display = 'none';
    optionsView.style.display = 'block';
    optionsButton.style.display = 'none';
    refreshButton.style.display = 'none';
    backButtonHeader.style.display = 'block';
    restoreOptions();
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

    const actionButtonsContainer = document.createElement('div');
    actionButtonsContainer.className = 'button-group';

    const viewOriginalButton = document.createElement('button');
    viewOriginalButton.textContent = 'View Original Email';
    viewOriginalButton.className = 'copy-button';
    viewOriginalButton.addEventListener('click', () => {
      const gmailUrl = `https://mail.google.com/mail/u/0/#inbox/${item.messageId}`;
      chrome.tabs.create({ url: gmailUrl });
    });

    actionButtonsContainer.append(copyReplyButton, viewOriginalButton);
    contentBody.append(summaryTitle, summaryContent, copySummaryButton, replyTitle, replyContent, actionButtonsContainer);

    // Click event for accordion behavior which happens one at a time
    header.addEventListener('click', () => {
      const wasActive = header.classList.contains('active');

      // Close all currently active items
      document.querySelectorAll('.summary-header.active').forEach(activeHeader => {
        activeHeader.classList.remove('active');
        const content = activeHeader.nextElementSibling;
        if (content && content.classList.contains('summary-content-body')) {
          content.style.maxHeight = null;
        }
      });

      // If the clicked item was not already active so open it
      if (!wasActive) {
        header.classList.add('active');
        contentBody.style.maxHeight = contentBody.scrollHeight + 'px';
      }
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

  // Listen for messages from the background script (for example when summaries are ready)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'summariesUpdated') {
      console.log('Popup received summariesUpdated message. Updating UI.');
      updateUI();
    }
  });

  // Options view logic starts here
  backButtonHeader.addEventListener('click', () => {
    optionsView.style.display = 'none';
    mainView.style.display = 'block';
    backButtonHeader.style.display = 'none';
    optionsButton.style.display = 'block';
    updateUI();
  });

  // Saves options to chrome.storage.sync and triggers a refresh
  function saveOptions() {
    const maxEmails = parseInt(maxEmailsInput.value, 10);

    saveButton.textContent = 'Saving...';

    chrome.storage.sync.set({ maxEmails: maxEmails }, () => {
      optionsView.style.display = 'none';
      mainView.style.display = 'block';
      backButtonHeader.style.display = 'none';
      optionsButton.style.display = 'block';
      showLoadingState();
      chrome.runtime.sendMessage({ action: 'login' });
    });
  }

  // Restores settings using the preferences stored in chrome.storage
  function restoreOptions() {
    // Use a default value of maxEmails = 5
    chrome.storage.sync.get({ maxEmails: 5 }, (items) => {
      maxEmailsInput.value = items.maxEmails;
      saveButton.textContent = 'Save';
    });
  }

  saveButton.addEventListener('click', saveOptions);

  // Initial UI update when the popup is opened
  updateUI();
});
