# Local sample data

`seed.mjs` fills the **Firebase emulators** with sample accounts and listings, so everyone on the
team tests against the same data. It only talks to `127.0.0.1`. It never touches the real project.

## Run it

You need Node 22 (see "Node version" below). Use two terminals in the project folder.

```bash
# Terminal 1: start the emulators (dashboard at http://127.0.0.1:4000)
npx firebase emulators:start --project optic-d2702

# Terminal 2: load the sample data
node scripts/seed.mjs

# Terminal 3 (optional): serve the app, then open http://localhost:5500/profile.html
python3 -m http.server 5500
```

Notes:
- Run `node scripts/seed.mjs` again any time. It wipes the emulator data and loads the same sample data.
- Stopping the emulators throws away all local data. Run the seed script again to get it back.
- Open the app from `localhost` (not a file or another address), or it will use the real project.
- Port 5000 is taken by AirPlay on a Mac, so use 5500.

## Logins (all passwords: `bento123`)

| Email | Role | What it's for |
|---|---|---|
| alice@student.gsu.edu | owner | Owns **Braids by Alice**: 6 listings, including one **hidden** |
| ben@student.gsu.edu | owner | Owns **Ben's Tech Fix** (5 listings, one **removed**) and **Panther Bites**, a **suspended** business |
| chloe@student.gsu.edu | organization | Owns **GSU Photography Club**: 2 upcoming events, 1 past event, a service and a product |
| dana@student.gsu.edu | student | A plain student with no business. Good for browsing, favorites and reviews |
| admin@student.gsu.edu | admin | Can see suspended profiles and removed listings |

All five emails are already verified.

## What gets loaded

- 8 categories: beauty, food, photography, art, tutoring, tech-repair, fashion, clubs-social
- 4 profiles: 2 businesses, 1 club, 1 suspended business
- 16 listings: products, services and events; prices from Free to $150
  - 1 hidden (Edge Control Gel), 1 removed (Refurbished Phone)
  - 2 upcoming events and 1 past event (dates are set relative to the day you run the script)

## Node version

The Firebase emulator needs Node 22. If `node -v` shows 25, install 22 with `brew install node@22`
and run this in the terminal first (it lasts for that terminal only):

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
```