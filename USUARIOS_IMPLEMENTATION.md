# Usuarios Dashboard - Implementation Summary

## Overview
Implemented a complete **Users Management Dashboard** with user listing, conversation viewing, blocking/unblocking, history deletion, and direct messaging capabilities.

## Backend Changes

### 1. User Profile Store (`src/userProfileStore.js`)
**New Functions:**
- `isUserBlocked(userId)` - Check if a user is blocked
- `setUserBlocked(userId, blocked)` - Block/unblock a user
- `listUserProfiles()` - Get all users sorted by last seen (descending)

**Updated:**
- `getUserProfile()` now initializes `blocked: false` property for all users

### 2. History Store (`src/config/historyStore.js`)
**New Functions:**
- `getHistoryByChatId(chatId, limit = 100)` - Get conversation history for a specific user
- `clearHistoryForChatId(chatId)` - Delete all history for a specific user

### 3. Server (`src/server.js`)
**Imports Updated:**
- Added: `listUserProfiles`, `isUserBlocked`, `setUserBlocked` from userProfileStore
- Added: `addHistoryEntry`, `getHistoryByChatId`, `clearHistoryForChatId` from historyStore

**New Endpoints:**
```
GET    /api/users              - List all users with profiles
GET    /api/users/:id/history  - Get conversation history for user
POST   /api/users/:id/history/clear  - Delete user history
POST   /api/users/:id/block    - Block/unblock user (req.body: { blocked: boolean })
POST   /api/users/:id/message  - Send direct Telegram message (req.body: { text: string })
```

**Security:**
- Webhook now checks `isUserBlocked(userId)` and ignores messages from blocked users
- Logs: `[BLOCKED] Usuario {id} bloqueado. Ignorando mensaje.`

**History Tracking:**
- All responses (GPT and STRUCTURED) now include `chatId` in history entries
- Format: `addHistoryEntry({ question, answer, context, usedDocuments, chatId })`

## Admin UI Changes

### 1. App Setup (`admin-ui/src/App.tsx`)
- Added route: `/usuarios` → `<UsersPage />`
- Route registered in React Router with SPA fallback

### 2. Sidebar (`admin-ui/src/components/AppSidebar.tsx`)
- Added "Usuarios" menu item (👥 icon) pointing to `/usuarios`
- Order: Home → Contexto → Documentos → Historial → **Usuarios** → Actividad → Aprendizaje

### 3. API Client (`admin-ui/src/lib/api.ts`)
**New Types:**
```typescript
interface UserProfile {
  userId: string | number;
  name: string | null;
  firstSeen: string;
  lastSeen: string;
  messageCount: number;
  topics: string[];
  preferences: Record<string, any>;
  conversationStyle: "formal" | "casual";
  blocked: boolean;
}
```

**New Functions:**
```typescript
listUsers(): Promise<UserProfile[]>
getUserHistory(userId: string): Promise<HistoryEntry[]>
clearUserHistory(userId: string): Promise<{ ok: boolean }>
blockUser(userId: string, blocked: boolean): Promise<UserProfile>
sendMessageToUser(userId: string, text: string): Promise<{ ok: boolean }>
```

### 4. Pages (`admin-ui/src/pages/`)
**New File: `UsersPage.tsx`**
- Layout: List (left) + Details & History (right) on lg screens, stacked on mobile
- Displays user counts and interaction stats

### 5. Components (`admin-ui/src/components/`)
**New File: `UsersPanel.tsx`**

**Features:**
1. **User List** (scrollable, max-height 400px)
   - Shows name (or "Usuario {id}") and message count
   - Selected user highlighted with primary color
   - Lock icon for blocked users

2. **User Details Section**
   - Name, ID, first contact date, last contact date, message count, conversation style
   - **Actions:**
     - 🔒 Block/🔓 Unlock button (toggles with appropriate styling)
     - 🗑️ Clear History button (with confirmation dialog)
   - Status badge: "BLOQUEADO" displayed in red when user is blocked

3. **Direct Messaging**
   - Input field + Send button
   - Enter key to send (Shift+Enter for newline)
   - Disabled states for loading

4. **Conversation Viewer**
   - Displays all Q&A exchanges for selected user
   - Each exchange shows:
     - 👤 User question
     - 🤖 Bot response
     - Timestamp (formatted)
   - Scrollable, max-height 400px
   - Shows "No conversations yet" when empty

5. **State Management**
   - Uses React hooks: `useState`, `useEffect`
   - Loads user list on mount
   - Loads history when user selected
   - Toast notifications for success/error (via `sonner`)

## Data Flow

### User Blocking
1. Admin clicks "Bloquear" / "Desbloquear" in UI
2. POST `/api/users/:id/block` with `{ blocked: true/false }`
3. Backend updates profile and persists to `user-profiles.json`
4. Next message from blocked user → webhook checks → ignored
5. UI updates user profile and displays badge

### Direct Messaging
1. Admin types message in input field
2. POST `/api/users/:id/message` with `{ text: "..." }`
3. Backend sends via Telegram API: `sendTelegramMessage(userId, text)`
4. Message delivered directly to user's Telegram chat

### History Management
1. Admin clicks "Limpiar historial"
2. Confirmation dialog
3. POST `/api/users/:id/history/clear`
4. Backend calls `clearHistoryForChatId()` → removes all entries for user
5. UI clears history display

## Files Modified
- ✅ `src/userProfileStore.js` - Added blocking functions
- ✅ `src/config/historyStore.js` - Added per-user history queries
- ✅ `src/server.js` - Added endpoints, blocking check, history tracking
- ✅ `admin-ui/src/App.tsx` - Added Users route
- ✅ `admin-ui/src/components/AppSidebar.tsx` - Added Users menu
- ✅ `admin-ui/src/lib/api.ts` - Added API client functions & types

## Files Created
- ✅ `admin-ui/src/pages/UsersPage.tsx` - Users page layout
- ✅ `admin-ui/src/components/UsersPanel.tsx` - Full users management component

## Database Files
- **user-profiles.json** - Updated with `blocked: boolean` property
- **history.json** - Now includes `chatId` on all entries (from webhook)

## Testing Checklist
- [ ] Admin lists users and sees all profiles
- [ ] Admin selects user and views conversation
- [ ] Admin blocks user → user's next message is ignored
- [ ] Admin unblocks user → user can message again
- [ ] Admin clears user history → history empty but user account preserved
- [ ] Admin sends direct message → user receives on Telegram
- [ ] Multiple users have separate histories
- [ ] Blocked status persists across restarts

## Notes
- Blocking is **silent** - blocked users don't know they're blocked (they send messages that are silently ignored)
- Direct messages bypass the bot's normal conversation flow - they come directly from admin
- User profiles remain even after clearing history
- All timestamps are ISO format for consistency
- UI is responsive - 3-column on desktop, stacked on mobile
