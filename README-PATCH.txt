UniLink profile patch

Files:
- app/(tabs)/profile.tsx
- app/profile/hidden.tsx

Backend verification note:
The inspected UNILINK-BACKEND currently has no routes for:
GET /posts/user/:userId/reshares
GET /posts/liked
GET /posts/hidden
DELETE /posts/hidden/:id

The mobile code therefore does not fabricate those collections. Reshared/Liked
will report the real API failure until those backend contracts exist; Hidden
will show an empty state if its endpoint is absent.

Protected files not included:
- app/(tabs)/campus.tsx
- app/(tabs)/community.tsx
- app/(tabs)/messages.tsx

Validation after unzip:
CI=1 NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit --pretty false
git diff --check
