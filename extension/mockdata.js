export const MOCK_SUMMARIES = [
  {
    messageId: 'mock123abc',
    subject: 'Mock Email: Project Update',
    sender: 'team@example.com',
    summary: 'This is a mock summary for the project update. We are on track to meet the Q3 deadline. All major components are integrated and passing initial tests.',
    reply_draft: 'Thanks for the update! Glad to hear we are on track. Let me know if the design team can help with anything.'
  },
  {
    messageId: 'mock456def',
    subject: 'Re: Your recent order',
    sender: 'support@example.com',
    summary: 'A mock summary regarding your recent order. It has been shipped via Express Courier and is expected to arrive in 2-3 business days.',
    reply_draft: 'Thank you for letting me know. I look forward to receiving it.'
  },
  {
    messageId: 'mock789ghi',
    subject: 'Meeting Reminder',
    sender: 'team@example.com',
    summary: 'This is a mock summary for the meeting reminder. The meeting is scheduled for tomorrow at 10 AM to discuss the new marketing strategy.',
    reply_draft: 'Thanks for the reminder. I will be there.'
  },
  {
    messageId: 'mock101jkl',
    subject: 'Newsletter - October Edition',
    sender: 'newsletter@example.com',
    summary: 'This is a mock summary for the October newsletter. It contains the latest updates and articles from our team.',
    reply_draft: 'Thank you for the newsletter. I found the articles very informative.'
  },
  {
    messageId: 'mock202mno',
    subject: 'Invitation to Webinar',
    sender: 'team@example.com',
    summary: 'This is a mock summary for the webinar invitation. The webinar will cover the latest trends in the industry and is scheduled for next week.',
    reply_draft: 'Thank you for the invitation. I would like to attend the webinar.'
  },
  {
    messageId: 'mock303pqr',
    subject: 'Follow-up on Project X',
    sender: 'manager@example.com',
    summary: 'This is a mock summary for the follow-up email on Project X. We need to finalize the requirements by the end of the week.',
    reply_draft: 'Thanks for the update. I will make sure to have the requirements ready by Friday.'
  },
  {
    messageId: 'mock404stu',
    subject: 'Your Subscription is Expiring',
    sender: 'billing@example.com',
    summary: 'This is a mock summary for the subscription expiration notice. Your subscription will expire in 3 days.',
    reply_draft: 'Thank you for the reminder. I will renew my subscription soon.'
  },
  {
    messageId: 'mock505vwx',
    subject: 'Feedback Request',
    sender: 'customer@example.com',
    summary: 'This is a mock summary for the feedback request email. The customer is requesting feedback on their recent purchase.',
    reply_draft: 'Thank you for reaching out. I will provide feedback on my purchase shortly.'
  }
];

// Injects mock data for development purposes bypassing API calls
export async function useMockData() {
  console.log('USING MOCK DATA');
  try {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const { maxEmails } = await chrome.storage.sync.get({ maxEmails: 5 });
    const slicedMockData = MOCK_SUMMARIES.slice(0, maxEmails);
    await chrome.storage.session.set({ summariesList: slicedMockData });
    const count = slicedMockData.length;
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  } finally {
    chrome.runtime.sendMessage({ action: 'summariesUpdated' }, () => {
      if (chrome.runtime.lastError) {
        console.log('Popup not open. State saved. Update on next open');
      }
    });
  }
}
