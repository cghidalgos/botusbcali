# Usuarios Dashboard - Quick Start Guide

## How It Works

### For Admin Users

#### 1. **Access Users Dashboard**
- Navigate to the admin panel (port 9014)
- Click "Usuarios" in the sidebar (or go directly to `/usuarios`)

#### 2. **View All Users**
- Left panel shows all active users
- Sorted by last activity
- Shows name (or user ID) and message count
- Locked icon 🔒 indicates blocked users

#### 3. **Select a User**
- Click on any user in the list
- Right panel shows:
  - User details (name, ID, contact dates, message count, conversation style)
  - Action buttons (Block/Unblock, Clear History)
  - Direct message input
  - Full conversation history

#### 4. **Block a User**
- Click "Bloquear" button
- User's messages will be silently ignored (they won't know they're blocked)
- Click "Desbloquear" to re-enable

#### 5. **Send Direct Message**
- Type in the message input field
- Press Enter or click Send button
- Message delivered directly via Telegram
- Bypasses normal bot conversation flow

#### 6. **Delete User History**
- Click "Limpiar historial" button
- Confirm deletion
- All conversations removed (user profile preserved)

---

### For Users (How They Experience It)

#### Being Blocked
- They continue to send messages normally
- Bot appears to ignore their messages (silent blocking)
- No error message or notification
- Other admin features still affect them (if re-enabled)

#### Receiving Direct Messages
- Messages appear in their Telegram chat with the bot
- Marked as coming from the admin/bot
- Separate from normal conversation flow

#### Interaction Tracking
- Every question and answer is automatically recorded
- Stored with chatId, timestamps, and context
- Admin can review anytime

---

## Component Structure

```
UsersPage
├── UsersPanel
│   ├── Left Sidebar (User List)
│   │   ├── Refresh button
│   │   └── User List Items
│   │       ├── User name/ID
│   │       ├── Message count
│   │       └── Block indicator
│   │
│   └── Right Panel (User Details) [ONLY if user selected]
│       ├── User Info Card
│       │   ├── Name, ID, dates, message count
│       │   └── Actions: Block/Unblock, Clear History
│       │
│       ├── Direct Message Card
│       │   ├── Message input
│       │   └── Send button
│       │
│       └── Conversation History Card
│           ├── Q&A pairs
│           ├── Timestamps
│           └── Scrollable list
```

---

## API Endpoints Reference

### List Users
```
GET /api/users
Response: UserProfile[]
```

### Get User History
```
GET /api/users/:id/history
Response: HistoryEntry[]
Limit: Last 100 entries
```

### Clear User History
```
POST /api/users/:id/history/clear
Response: { ok: true }
```

### Block/Unblock User
```
POST /api/users/:id/block
Body: { blocked: boolean }
Response: UserProfile (updated)
```

### Send Direct Message
```
POST /api/users/:id/message
Body: { text: string }
Response: { ok: true }
```

---

## Data Structures

### UserProfile
```typescript
{
  userId: string | number,        // Telegram chat ID
  name: string | null,            // Detected from intro message
  firstSeen: string,              // ISO date
  lastSeen: string,               // ISO date
  messageCount: number,           // Total messages sent
  topics: string[],               // Topics of interest detected
  preferences: {},                // Reserved for future use
  conversationStyle: "formal" | "casual",  // Detected from language
  blocked: boolean                // If user can send messages
}
```

### HistoryEntry
```typescript
{
  question: string,               // User's message
  answer: string,                 // Bot's response
  timestamp: number,              // Unix timestamp (ms)
  context: string,                // Current context state
  usedDocuments: string[],        // Document names used
  chatId: string                  // User's Telegram chat ID
}
```

---

## Common Tasks

### Task: Block a spamming user
1. Go to Users dashboard
2. Find user in the list
3. Click to select them
4. Click "Bloquear" button
5. User is now blocked silently

### Task: Review conversation with a user
1. Go to Users dashboard
2. Click on the user
3. Scroll through conversation in the history panel
4. All exchanges shown chronologically

### Task: Send important message to all users
1. In Users dashboard, select each user
2. Type message in the input field
3. Click Send
4. Message delivered to their Telegram

### Task: Clear history for GDPR compliance
1. Find user
2. Click "Limpiar historial"
3. Confirm deletion
4. History cleared, user profile (name, preferences) preserved

---

## Technical Implementation

### Security
- Blocked users are checked at webhook level (src/server.js line ~540)
- History filtering by chatId in historyStore.js
- Telegram API calls use TELEGRAM_BOT_TOKEN environment variable

### Performance
- User list sorted by lastSeen (O(n log n) on load)
- History queries limited to 100 entries per user
- Pagination available via limit parameter

### Persistence
- User profiles stored in `data/user-profiles.json`
- Conversation history in `data/history.json`
- Both synced to disk after every operation

---

## Troubleshooting

### Users Not Appearing in List
- Check if they've sent at least one message to the bot
- Verify TELEGRAM_BOT_TOKEN is set
- Check data/user-profiles.json exists

### Can't Send Direct Messages
- Verify TELEGRAM_BOT_TOKEN is configured
- Check user's chatId is correct (shown in UI)
- Ensure user hasn't blocked the bot on Telegram

### History Not Showing
- History only shows conversations (Q&A pairs)
- Ensure chatId is being passed to addHistoryEntry
- Check that users have actually had conversations

### Blocked User Can Still Message
- Webhook check occurs BEFORE routing
- Ensure build includes latest server.js
- Restart backend for changes to take effect
- Check user.blocked property in user-profiles.json is `true`

---

## Future Enhancements
- [ ] Export conversation history as PDF
- [ ] User activity timeline/heatmap
- [ ] Batch block/unblock multiple users
- [ ] Message scheduling
- [ ] User tagging/groups
- [ ] Sentiment analysis visualization
- [ ] User behavior analytics
