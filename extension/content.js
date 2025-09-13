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

  fab.onclick = (e) => {
    e.stopPropagation();
    const messageId = getMessageId();
    if (messageId) {
      console.log('Summarize button clicked for message ID:', messageId);
      fab.disabled = true;
      // Placeholder loading state
      fab.textContent = '...';
      chrome.runtime.sendMessage({ action: 'summarizeSingleEmail', messageId: messageId });
    } else {
      console.error('Could not find message ID.');
      alert('Could not identify the email to summarize.');
    }
  };

  document.body.appendChild(fab);
}

function showSummaryOverlay(data) {
  document.querySelector('.summary-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'summary-overlay';

  overlay.innerHTML = `
    <div class="summary-card">
      <button class="summary-card-close">&times;</button>
      <h2>Summary of: ${data.subject}</h2>
      <p>${data.summary}</p>
      <hr>
      <h2>Suggested Reply:</h2>
      <p>${data.reply_draft}</p>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close overlay when clicking the close button or outside the card
  overlay.querySelector('.summary-card-close').onclick = () => overlay.remove();
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showSummary') {
    showSummaryOverlay(request.data);
  } else if (request.action === 'error') {
    alert(`Error: ${request.message}`);
  }

  // Always reset the floating button state after a response
  const fab = document.getElementById('summarize-fab');
  if (fab) {
    fab.disabled = false;
    fab.textContent = 'Summarise';
  }
});

// Inject floating button on initial load, it will be hidden by default
injectFab();

const observer = new MutationObserver((mutations) => {
  const fab = document.getElementById('summarize-fab');
  if (!fab) return;

  // Most reliable indicator of an open email is the presence of this element
  const isEmailOpen = !!document.querySelector('[data-legacy-message-id]');

  if (isEmailOpen) {
    // Show the button if an email is open
    fab.classList.add('visible');
  } else {
    // Hide button if no email is open
    fab.classList.remove('visible');
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
