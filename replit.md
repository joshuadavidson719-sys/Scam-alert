# Scam Alert — Mobile Social Media App

## Overview
Full-featured mobile social media app built with Expo (React Native) focused on scam awareness, community reporting, and AI-powered fraud detection.

## Architecture

### Artifacts
- **`artifacts/scam-alert`** — Expo mobile app (React Native + Expo Router)
- **`artifacts/api-server`** — Express API server with scam-check endpoint
- **`artifacts/mockup-sandbox`** — Component preview canvas (Vite)

### Tech Stack
- **Frontend**: Expo SDK 54, Expo Router v6, React Native
- **Auth & Database**: Firebase Auth + Firestore
- **AI**: OpenAI via Replit AI Integrations proxy (`/api/scam-check`)
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

Without these, the app shows a warning banner and login/signup will fail.

## Firestore Collections
- `users/{uid}` — UserProfile (username, bio, niche, followers, following, isAdmin, pushToken)
- `posts/{id}` — PostData (authorId, title, description, category, likes, commentCount, shareCount, images)
- `posts/{id}/comments/{id}` — Comment (authorId, text, createdAt)
- `chats/{chatId}` — Chat metadata (participants, lastMessage, unreadCounts map per userId)
- `chats/{chatId}/messages/{id}` — Message (senderId, text)
- `reports/{id}` — Report (reporterId, targetId, reason, status)

## Theme
- Dark red-alert theme: primary `#FF3B3B`
- Dark mode background: `#0D0D0D`
- Light mode background: `#F8F8F8`
- Full dark/light theme support via `useColors()` hook

## App Screens

### Auth Flow
- `app/(auth)/login.tsx` — Login with email/password
- `app/(auth)/signup.tsx` — Create account
- `app/(auth)/onboarding.tsx` — Pick niche (post-signup)

### Tab Navigation (5 tabs)
- `app/(tabs)/index.tsx` — Home feed with category filter + 🔥 Trending carousel
- `app/(tabs)/explore.tsx` — Search posts/users + category browser + AI checker CTA
- `app/(tabs)/create.tsx` — Create new post
- `app/(tabs)/messages.tsx` — DM conversation list
- `app/(tabs)/profile.tsx` — Own profile, posts, settings

### Detail Screens
- `app/post/[id].tsx` — Full post with like/comment/report
- `app/user/[id].tsx` — User profile with follow/message
- `app/chat/[id].tsx` — Real-time 1:1 chat
- `app/scam-checker.tsx` — AI scam analysis modal

### Admin & Legal
- `app/admin.tsx` — Moderation panel (admin only)
- `app/legal/privacy.tsx` — Privacy Policy
- `app/legal/guidelines.tsx` — Community Guidelines

## Key Components
- `components/PostCard.tsx` — Feed post with like/comment/share/report
- `components/TrendingCarousel.tsx` — Horizontal hot-scored trending post carousel
- `components/FollowSuggestions.tsx` — "People to Follow" niche-matched horizontal scroll
- `components/UserAvatar.tsx` — Avatar with initials fallback
- `components/CategoryPill.tsx` — Category filter chip
- `components/CommentSheet.tsx` — Bottom sheet comment section
- `components/ReportModal.tsx` — Report post with reason selection

## Key Hooks
- `hooks/useTrendingPosts.ts` — Scores posts by likes×3 + comments×2 + shares×1.5 − time decay
- `hooks/useFollowSuggestions.ts` — Suggests users by matching niche, excluding already-followed
- `hooks/useUnreadMessages.ts` — Real-time unread DM count summed across all chats
- `hooks/useColors.ts` — Returns theme palette for current color scheme

## API Server
- `GET /api/healthz` — Health check
- `POST /api/scam-check` — AI scam analysis (OpenAI)

## Categories
scam-alert, news, motivation, health, finance, crime-awareness, technology, education, entertainment

## Environment Secrets
- `SESSION_SECRET` — Set
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Set (via Replit AI Integrations)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Set (via Replit AI Integrations)
- Firebase credentials — Not yet set (pending user input)
