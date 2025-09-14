console.log('Email Summariser content script loaded.');

function getMessageId() {
  const messageEl = document.querySelector('[data-legacy-message-id]');
  if (!messageEl) {
      console.error('Email Summariser: Could not find element with [data-legacy-message-id]. Gmail DOM may have changed.');
      return null;
  }
  return messageEl.getAttribute('data-legacy-message-id');
}

// Creates and injects the Floating Action Button (FAB) into the page
// This button is independent of Gmail's UI structure
function injectFab() {
  // Check if the FAB already exists to avoid duplicates
  if (document.getElementById('summarize-fab')) return;

  const fab = document.createElement('button');
  fab.id = 'summarize-fab';
  fab.className = 'summarize-fab';
  fab.title = 'Summarize this email';
  fab.textContent = 'Summarise';

  const summaryContainer = document.createElement('div');
  summaryContainer.id = 'inline-summary-container';
  summaryContainer.className = 'inline-summary-container';

  fab.onclick = (e) => {
    e.stopPropagation();
    const messageId = getMessageId();
    if (messageId) {
      console.log('Summarize button clicked for message ID:', messageId);
      
      fab.classList.remove('visible');
      summaryContainer.innerHTML = '<p class="summary-loading-text">Summarising...</p>';
      // Add both 'visible' and 'loading' classes to show the small loading box
      summaryContainer.classList.add('visible', 'loading');

      chrome.runtime.sendMessage({ action: 'summarizeSingleEmail', messageId: messageId });
    } else {
      console.error('Could not find message ID.');
      alert('Could not identify the email to summarise.');
    }
  };

  document.body.appendChild(fab);
  document.body.appendChild(summaryContainer);
}

// Helper to create the copy to clipboard button taken from popup.js
function createCopyButton(textToCopy, label = 'Copy') {
  const button = document.createElement('button');
  button.textContent = label;
  button.className = 'copy-button';
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(textToCopy);
    button.textContent = 'Copied!';
    setTimeout(() => (button.textContent = label), 1500);
  });
  return button;
}

function renderInlineSummary(container, data) {
  const fab = document.getElementById('summarize-fab');

  // Clear the "Summarising..." text
  container.innerHTML = '';

  // Create and append elements for the new layout
  const closeButton = document.createElement('button');
  closeButton.className = 'inline-summary-close-btn';
  closeButton.textContent = 'Close';

  const summaryHeading = document.createElement('h2');
  summaryHeading.textContent = 'Summary';

  const subjectPara = document.createElement('p');
  subjectPara.style.fontWeight = 'bold';
  subjectPara.style.marginTop = '-5px';
  subjectPara.textContent = data.subject;

  const summaryContent = document.createElement('p');
  summaryContent.textContent = data.summary;

  const replyHeading = document.createElement('h2');
  replyHeading.textContent = 'Suggested Reply';

  const replyContent = document.createElement('p');
  replyContent.textContent = data.reply_draft;

  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'button-group';

  const copySummaryBtn = createCopyButton(data.summary, 'Copy Summary');
  const copyReplyBtn = createCopyButton(data.reply_draft, 'Copy Reply');
  buttonGroup.appendChild(copySummaryBtn);
  buttonGroup.appendChild(copyReplyBtn);

  // Append all elements to the container in the correct order
  container.append(closeButton, summaryHeading, subjectPara, summaryContent, replyHeading, replyContent, buttonGroup);

  // Remove the loading class to trigger the expansion animation
  container.classList.remove('loading');

  // Add event listener for the new close button
  closeButton.onclick = () => {
    container.classList.remove('visible');
    // Show the main button again if the email is still open
    if (!!document.querySelector('[data-legacy-message-id]')) {
      fab.classList.add('visible');
    }
  };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const summaryContainer = document.getElementById('inline-summary-container');
  const fab = document.getElementById('summarize-fab');

  if (request.action === 'showSummary') {
    renderInlineSummary(summaryContainer, request.data);
  } else if (request.action === 'error') {
    alert(`Error: ${request.message}`);
    summaryContainer.classList.remove('visible', 'loading');
    if (fab) fab.classList.add('visible');
  }
});

injectFab();

const observer = new MutationObserver((mutations) => {
  const fab = document.getElementById('summarize-fab');
  const summaryContainer = document.getElementById('inline-summary-container');
  if (!fab || !summaryContainer) return;
  
  const isEmailOpen = !!document.querySelector('[data-legacy-message-id]');

  if (isEmailOpen) {
    if (!summaryContainer.classList.contains('visible')) {
      fab.classList.add('visible');
    }
  } else {
    fab.classList.remove('visible');
    summaryContainer.classList.remove('visible');
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
