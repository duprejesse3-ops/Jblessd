# multiNicheAI 1.0 — backend starter

API-backed AI assistant engine for multinicheai.com, using Claude as the underlying
model with a fair, transparent credit system on top.

## What's in here
- `PRICING-PLAN.md` — credit pricing model and fair-practice principles
- `backend/app/models.py` — database schema (users, credit balances, purchases, usage logs)
- `backend/app/credits.py` — credit cost estimation and deduction logic
- `backend/app/chat.py` — chat endpoint, wraps the Claude API, meters credits
- `backend/app/stripe_routes.py` — Stripe checkout + webhook for credit pack purchases
- `backend/app/database.py` — Postgres connection setup
- `backend/app/main.py` — FastAPI app entrypoint

## Setup
1. Install Postgres locally or use a hosted instance (Supabase, Railway, RDS, etc.)
2. `cd backend && pip install -r requirements.txt`
3. Copy `.env.example` to `.env` and fill in your real keys (Anthropic API key, Stripe keys, database URL)
4. Run the server: `uvicorn app.main:app --reload`
5. Test it's alive: `GET http://localhost:8000/health`

## Endpoints
- `POST /chat/estimate` — preview credit cost before sending (fair-practice: cost shown up front)
- `POST /chat/send` — send a message, get a reply, credits deducted based on actual usage
- `POST /billing/checkout/{pack_id}` — create a Stripe Checkout session for a credit pack
- `POST /billing/webhook` — Stripe webhook, credits the user's account on successful payment

## What's in here now

### backend/ — API server
- `app/auth_routes.py` + `app/auth_utils.py` — signup/login, JWT tokens, bcrypt password hashing. New signups get 10 free credits.
- `app/models.py` — users, credit balances, purchases, usage logs
- `app/credits.py` — cost estimation and deduction
- `app/chat.py` — chat endpoint wrapping Claude, requires a valid auth token, grounds every reply in real catalog matches
- `app/catalog.py` — pulls live products from `/api/products`, keyword/niche/category-matches them against the customer's message, feeds the top matches into the system prompt so replies use real SKUs/prices instead of guesses (5-min cache; falls back to stale cache if the catalog API is down rather than breaking chat)
- `app/stripe_routes.py` — checkout + webhook, now tied to the logged-in user via token
- `app/main.py` — wires it all together

### app/ — React Native client (phone + Windows)
- `screens/AuthScreen.js` — signup/login
- `screens/ChatScreen.js` — chat UI with live credit balance and pre-send cost check
- `screens/CreditsScreen.js` — buy credit packs, opens Stripe Checkout
- `api/client.js` — shared API client, handles auth token storage
- `App.js` — navigation entry point
- `WINDOWS.md` — how to package this same app as a Windows `.exe` via Tauri or Electron

### storefront-widget/ — multinicheai.com embed
- `multinicheai-widget.html` — drop-in chat bubble widget. Creates a lightweight guest account automatically so visitors can chat without a signup wall; shares the same backend and credit system as the app.

## Setup order
1. Deploy the backend (fill in `.env` from `.env.example`, run migrations via `Base.metadata.create_all`)
2. Point `app/api/client.js` and the widget's `API_BASE_URL` at your deployed backend URL
3. Run the RN app with `npm install && npx expo start`
4. Paste the widget snippet into your Netlify site before `</body>`

## Not included yet (next steps)
- Admin dashboard for usage/revenue monitoring
- Upgrade catalog matching from keyword search to embeddings (pgvector, since you're already on Postgres) if the catalog grows past a few hundred products and keyword overlap stops finding the right matches
- Rate limiting / abuse protection on the guest-account widget flow

Let me know which of these you want built next.
