document.getElementById('login-button').addEventListener('click', () => {
  // Send a message to the background script to start the auth flow
  chrome.runtime.sendMessage({ action: 'login' });
  // Close the popup for a better user experience after button is clicked
  window.close();
});
