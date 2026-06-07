# GroceryDeals Near Me

Find today's grocery deals and sales at stores near you — powered by the Kroger API and Flipp.

---

## Features

- Search by ZIP code + radius (5 / 10 / 15 / 25 / 50 miles)
- Kroger-family stores (Kroger, Ralph's, Fred Meyer, Dillons, etc.) via official API
- 20+ other chains (Walmart, Publix, Safeway, ALDI, Whole Foods, etc.) via Flipp
- Today's deals only — filtered by current date
- Category filter bar (Produce, Dairy, Meat, Bakery, Frozen, …)
- Collapsible store sections with deal cards showing price, discount %, and "Today Only" badge
- Graceful degradation if one data source is unavailable

---

## Prerequisites

- **Node.js** v18 or later — https://nodejs.org
- **npm** v9 or later (bundled with Node.js)
- A free **Kroger Developer** account (see below)

---

## 1. Get a Kroger API Key (free)

1. Go to https://developer.kroger.com and click **Sign Up**.
2. Verify your email and log in.
3. Click **Create Application**.
4. Fill in a name (e.g. "GroceryDeals App") and description.
5. Under **Scopes**, check **product.compact** (read-only product/price data).
6. Copy your **Client ID** and **Client Secret** — you'll need them next.

---

## 2. Project Setup

```bash
# Clone or download this project
cd grocerydeals

# Copy the environment template
cp .env.example server/.env

# Edit server/.env and paste your Kroger credentials
# KROGER_CLIENT_ID=...
# KROGER_CLIENT_SECRET=...
```

---

## 3. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

---

## 4. Run the App

Open **two terminals**:

**Terminal 1 — backend:**
```bash
cd grocerydeals/server
npm run dev       # uses nodemon for auto-reload
# or: npm start  # plain node
```
Server starts on http://localhost:3001

**Terminal 2 — frontend:**
```bash
cd grocerydeals/client
npm start
```
React dev server starts on http://localhost:3000 and opens in your browser automatically.

---

## 5. Test with ZIP 30518

1. Enter ZIP code **30518** (Buford, GA)
2. Select **10 miles** radius
3. Click **Find Deals**

You should see Kroger-family stores and Flipp-sourced chains in the area with their current weekly deals.

---

## Project Structure

```
grocerydeals/
├── .env.example                  ← env variable template
├── README.md
│
├── server/
│   ├── index.js                  ← Express app entry point
│   ├── package.json
│   ├── .env                      ← your secrets (never commit this)
│   ├── routes/
│   │   ├── stores.js             ← GET /api/stores
│   │   └── deals.js              ← GET /api/deals
│   ├── services/
│   │   ├── geocode.js            ← ZIP → lat/lng via Zippopotam.us
│   │   ├── kroger.js             ← Kroger OAuth2 + store/product APIs
│   │   └── flipp.js              ← Flipp unofficial flyer API
│   └── utils/
│       └── haversine.js          ← Distance calculation
│
└── client/
    ├── package.json
    ├── tailwind.config.js
    ├── public/
    │   └── index.html
    └── src/
        ├── App.js                ← Root component / page router
        ├── index.js
        ├── index.css             ← Tailwind imports
        ├── pages/
        │   ├── LandingPage.js   ← ZIP + radius search form
        │   └── ResultsPage.js   ← Store list + deal cards
        └── components/
            ├── DealCard.js      ← Individual deal tile
            ├── StoreSection.js  ← Collapsible store accordion
            ├── FilterBar.js     ← Category pill filters
            └── Spinner.js       ← Loading indicator
```

---

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/stores?zip=30518&radius=10` | Nearby grocery stores with distance |
| GET | `/api/deals?zip=30518&radius=10` | All today's deals grouped by store |

---

## Data Sources

| Source | Coverage | Auth |
|--------|----------|------|
| [Zippopotam.us](https://api.zippopotam.us) | ZIP → coordinates | None (free) |
| [Kroger Developer API](https://developer.kroger.com) | Kroger, Ralph's, Fred Meyer, Dillons, Fry's, King Soopers, QFC, Mariano's, Harris Teeter | OAuth2 client credentials (free) |
| [Flipp](https://flipp.com) | Walmart, Safeway, Publix, ALDI, Whole Foods, Trader Joe's, H-E-B, Meijer, Wegmans, and 15+ more | None (unofficial public API) |

---

## Notes on the Flipp Integration

Flipp's API is unofficial and undocumented. It works by fetching public circular/flyer data the same way their web app does. This may break if Flipp changes their API. If Flipp requests fail, the app still returns Kroger data with a warning banner.

---

## Production Deployment

1. Build the React app: `cd client && npm run build`
2. Serve the `client/build` folder as static files from the Express server (add `express.static` middleware)
3. Set `CLIENT_ORIGIN` in your server `.env` to your production domain
4. Use a process manager like **PM2** or deploy to a platform like Railway, Render, or Fly.io

---

## License

MIT
