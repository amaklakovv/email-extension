document.addEventListener('DOMContentLoaded', () => {
  const maxEmailsInput = document.getElementById('max-emails');
  const saveButton = document.getElementById('save-button');
  const statusDiv = document.getElementById('status');

  // Saves options to chrome.storage.sync
  function saveOptions() {
    const maxEmails = parseInt(maxEmailsInput.value, 10);

    chrome.storage.sync.set({ maxEmails: maxEmails }, () => {
      // Update status to let user know options were saved
      statusDiv.textContent = 'Options saved.';
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 1500);
    });
  }

  // Restores settings using the preferences stored in chrome.storage
  function restoreOptions() {
    // Use a default value of maxEmails = 5
    chrome.storage.sync.get({ maxEmails: 5 }, (items) => {
      maxEmailsInput.value = items.maxEmails;
    });
  }

  restoreOptions();
  saveButton.addEventListener('click', saveOptions);
});
