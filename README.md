# Email Summariser Chrome Extension

A Chrome extension that helps you manage your inbox by automatically summarising unread emails and generating draft replies using AI.

It also allows you to summarize any individual email directly within the Gmail interface.

## Problem And My Solution
Managing a large amount of emails can be overwhelming, especially when you need to read and respond quickly. Based on both my personal experience and others, writing replies can sometimes take longer than expected because you second guess yourself and rewrite multiple times. 

I wanted to create a tool that summaries emails within Gmail so you don’t have to waste time by rereading and trying to interpret the message. It also helps by providing draft replies, making it faster and easier to respond confidently. This extension addresses these challenges by simplifying email reading and replying.

The goal is to help you overcome the initial friction of managing a busy inbox.

## Features

- **Automatic Unread Summaries**: Fetches your latest unread emails from Gmail and displays concise summaries in the extension popup.

- **Summaries in Gmail**: A floating 'Summarise' button appears when you open an email allowing you to generate a summary for any message.

- **Inline UI in Gmail**: View summaries and suggested replies directly on the Gmail page in a clean and non intrusive overlay
- **Configure the amount of summaries**: Set the maximum number of unread emails to fetch and summarize via the settings panel in the popup.

- **Test Mode**: Includes a placeholder data mode to test the UI and functionality without connecting a Google account or running the backend AI server.

- **AI Content**:
    - Generates short and clear summaries of email content.
    - Creates context aware draft replies automatically.

## How The Email Summariser Works

The extension has three main parts:
- **Popup UI**: The main interface which is accessible from the Chrome toolbar for viewing summaries of unread emails.

- **Content Script**: This injects a 'Summarise' button and summary card directly into the Gmail web interface.

- **Background Service Worker**: Handles authentication with Google, fetches email data through the Gmail API, and communicates with a local backend server for AI processing.

## Usage

### In the Popup
- Click the extension icon in your Chrome toolbar.

- Click 'Login with Google' to grant the necessary permissions.

- The extension will get and display summaries for your unread emails.

- Click on any summary to expand it and view the suggested reply.

- Use the 'Copy' buttons to copy content or 'View Original Email' to open it in a new tab.

### Inside Gmail
- Open any email conversation in Gmail.
- A 'Summarise' button will appear on the bottom-right of the page.
- Click it to generate and display a summary and suggested reply for that specific email.

## Security
- Uses OAuth 2.0 for Gmail API authentication

- Requires minimal Gmail permissions (gmail.readonlyg). The extension cannot modify or send emails on your behalf.

- Tokens are managed securely by Chrome's identity API.

- The AI processing is handled by a local backend server. Your email content is not sent to any third-party cloud services by the extension itself.

## Next steps
- Add more actions to the summary cards (Mark as Read, Archive).
- Allow customisation of the AI prompts used for summarization and reply generation.
- Improve error handling and user feedback for backend communication issues I have found.

## Acknowledgments
- Google Gmail API
- Google Gemini AI
- FastAPI framework
- Chrome Extensions API