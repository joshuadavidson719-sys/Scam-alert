# Scam Alert — Mobile Social Media App

## Overview
Full-featured mobile social media app built with Expo (React Native) focused on scam awareness, community reporting, and AI-powered fraud detection.

## Architecture

### Artifacts
- **`artifacts/scam-alert`** — Expo mobile app (React Native + Expo Router)
- **`artifacts/api-server`** — Express API server with AI analysis endpoints
- **`artifacts/mockup-sandbox`** — Component preview canvas (Vite)

### Tech Stack
- **Frontend**: Expo SDK 54, Expo Router v6, React Native
- **Auth & Database**: Firebase Auth + Firestore + Storage
- **AI**: OpenAI via Replit AI Integrations proxy
- **Camera**: `expo-camera` (QR scanner), `expo-image-picker` (photo upload)
- **Icons**: `@expo/vector-icons` (Feather)
- **Haptics**: `expo-haptics`
- **Fonts**: `@expo-google-fonts/inter` (400, 500, 600, 700)

## Firebase Setup (Required)
The app requires Firebase credentials as environment secrets:
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

## Firestore Collections
- `users/{uid}` — UserProfile (username, bio, niche, followers, following, isAdmin, pushToken, points)
- `posts/{id}` — PostData (authorId, title, description, category, likes, commentCount, shareCount, images)
- `posts/{id}/comments/{id}` — Comment (authorId, text, createdAt)
- `chats/{chatId}` — Chat metadata (participants, lastMessage, participantNames/Avatars)
- `chats/{chatId}/messages/{id}` — Message (senderId, text)
- `reports/{id}` — Report (reporterId, targetId, reason, status)

## Theme System (8 Themes)
- `ThemeContext` + `useColors()` support 8 modes: `dark`, `light` (neon green), `alert-red`, `midnight`, `ocean`, `safe-green`, `purple-haze`, `system`
- `CustomThemePicker` modal is accessible from Profile (Theme button) and Settings → Appearance
- Full color palettes for every mode in `constants/colors.ts`

## Gamification & Social Features
- **Streaks** — daily login streaks via `hooks/useStreak.ts`, shown as a pill on Profile
- **Achievements** — 12 unlockable achievements (4 rarities) via `hooks/useAchievements.ts`
- **Confetti** — 60-particle Reanimated animation (`components/Confetti.tsx`) fires on quiz/post events
- **AchievementToast** — slide-up unlock toast (`components/AchievementToast.tsx`)
- **ProfileFrame** — colored avatar ring based on badge rank (`components/ProfileFrame.tsx`)
- **Verified EXPERT Badge** — blue EXPERT chip on PostCard for verified authors

## Home Feed Components
- `components/TrendingScamsToday.tsx` — today's most-reported categories
- `components/ScamOfTheDay.tsx` — 12 rotating daily cards with expandable tips
- `components/NearbyAlerts.tsx` — expo-location + haversine, 200km radius
- `components/CommunityPoll.tsx` — live polls with animated progress bars + "Create Poll" CTA
- `components/LiveScamCounter.tsx` — real-time animated Firestore counter
- `components/ScamRadar.tsx` — Reanimated rotating radar sweep with alert levels

## Voice Notes (Chat)
- `expo-audio` installed; `components/VoiceNote.tsx` has `VoiceNoteRecorder` + `VoiceNotePlayer`
- Chat screen has a mic button → starts recording → sends as Firebase Storage file
- Messages with `type: "voice"` render as an audio player bubble

## Stories
- Emoji Story Reactions — tap "React" overlay while viewing, saves to Firestore `reactions` map
- 8 reaction emojis: 😱 🔥 👀 💪 🚨 😂 💔 👍

## Community Polls
- `app/create-poll.tsx` — full create-poll screen (question + up to 5 options + duration picker)
- Accessible from Create tab shortcut and CommunityPoll "No active poll" CTA
- Polls stored in `polls` Firestore collection

## App Screens

### Auth Flow
- `app/(auth)/login.tsx` — Login with email/password
- `app/(auth)/signup.tsx` — Create account
- `app/(auth)/onboarding.tsx` — Pick niche (post-signup)

### Tab Navigation (5 tabs)
- `app/(tabs)/index.tsx` — Home feed with category filter + 🔥 Trending carousel
- `app/(tabs)/explore.tsx` — Search posts/users + category browser + Scam Stats Chart
- `app/(tabs)/create.tsx` — Create post with device image picker (camera/gallery) + Firebase Storage upload
- `app/(tabs)/messages.tsx` — DM conversation list with New Message compose button
- `app/(tabs)/profile.tsx` — Own profile with Safety Tools grid, Edit Profile, Settings

### Detail Screens
- `app/post/[id].tsx` — Full post with like/comment/report
- `app/user/[id].tsx` — User profile with follow/unfollow + message
- `app/chat/[id].tsx` — Real-time 1:1 chat
- `app/scam-checker.tsx` — AI scam analysis (text/message checker)
- `app/edit-post/[id].tsx` — Edit own post (title, description, category)
- `app/new-message.tsx` — User search to start new DM

### Safety Tool Screens
- `app/link-checker.tsx` — AI URL/link safety analysis
- `app/phone-checker.tsx` — AI phone number scam detection
- `app/qr-scanner.tsx` — Camera QR code scanner with automatic safety check

### Social & Gamification
- `app/leaderboard.tsx` — Top contributors ranked by points with badge tiers

### Settings & Profile Management
- `app/settings.tsx` — Theme, notifications, safety tools, account management
- `app/edit-profile.tsx` — Edit username, bio, niche, profile photo

### Admin & Legal
- `app/admin.tsx` — Moderation panel (admin only) — manage flagged reports
- `app/legal/privacy.tsx` — Privacy Policy
- `app/legal/guidelines.tsx` — Community Guidelines

## Key Components
- `components/PostCard.tsx` — Feed post with like/comment/share/bookmark/edit/delete (own posts)
- `components/TrendingCarousel.tsx` — Horizontal hot-scored trending post carousel
- `components/FollowSuggestions.tsx` — Niche-matched "People to Follow" horizontal scroll
- `components/ScamStatsChart.tsx` — Bar chart of scam category distribution
- `components/UserAvatar.tsx` — Avatar with initials fallback
- `components/CategoryPill.tsx` — Category filter chip
- `components/CommentSheet.tsx` — Bottom sheet comment section with reply
- `components/ReportModal.tsx` — Report post with reason selection

## Key Hooks
- `hooks/useTrendingPosts.ts` — Scores posts by likes×3 + comments×2 + shares×1.5 − time decay
- `hooks/useFollowSuggestions.ts` — Suggests users by matching niche, excluding already-followed
- `hooks/useUnreadMessages.ts` — Real-time unread DM count summed across all chats
- `hooks/useBookmarks.ts` — AsyncStorage-backed bookmark list with toggle
- `hooks/usePoints.ts` — Points/badges system (POST_CREATED=10, LIKE_RECEIVED=2, etc.)
- `hooks/useColors.ts` — Returns theme palette for current color scheme

## API Server Endpoints
- `GET /api/healthz` — Health check
- `POST /api/scam-check` — AI analysis of scam message/text
- `POST /api/link-check` — AI URL/link safety analysis
- `POST /api/phone-check` — AI phone number scam detection

## Points & Badge System
Badge tiers in `hooks/usePoints.ts`:
- 🌱 Newcomer (0+ pts)
- 👀 Aware (20+ pts)
- 📢 Reporter (50+ pts)
- 🛡️ Guardian (100+ pts)
- 🔦 Sentinel (250+ pts)
- ⚔️ Protector (500+ pts)
- 🏆 Legend (1000+ pts)

Points awarded:
- POST_CREATED: +10
- LIKE_RECEIVED: +2
- COMMENT_MADE: +1
- SHARE_RECEIVED: +3

## Categories
scam-alert, news, motivation, health, finance, crime-awareness, technology, education, entertainment

## Environment Secrets
- `SESSION_SECRET` — Set
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Set (via Replit AI Integrations)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Set (via Replit AI Integrations)
- Firebase credentials — All 6 set as EXPO_PUBLIC_ secrets
