# The AI Scientist Backend

## What this is
An Express + TypeScript API that implements `POST /api/generate-plan` for the Lovable 7-tab frontend.

## Setup
1. Copy env vars:

```bash
cp .env.example .env
```

2. Install + run:

```bash
npm install
npm run dev
```

## API

### `POST /api/generate-plan`
Body:

```json
{
  "hypothesis": "Your hypothesis here",
  "experimentType": "cell-culture",
  "isReviewing": false
}
```

If `isReviewing=true`, the backend saves `editedText` to Supabase `ExpertMemory` instead of generating a new plan:

```json
{
  "hypothesis": "Same hypothesis",
  "experimentType": "cell-culture",
  "isReviewing": true,
  "editedText": "My corrections from a real scientist..."
}
```

