# Bento

Your student community, in one place. Bento is a Georgia State University web app for discovering student businesses, clubs, and events. It is built by Team Optic for CSC 4350 Software Engineering.

## Team

- Adrian Laguna
- Kadie Jenkins
- Mariam Kerzazi
- Harshvardhan Kamble

## Tech stack

- Front end: HTML, CSS, and JavaScript, built as an installable web app (PWA)
- Back end and database: Firebase (Authentication, Firestore, Storage)
- Access: only verified @gsu.edu and @student.gsu.edu accounts can use the database, enforced by firestore.rules

## Project layout

- js/firebase-config.js: Firebase setup, exports auth and db. On localhost it connects to the emulators.
- firestore.rules: Firestore security rules
- firestore.indexes.json: Firestore composite indexes
- firebase.json and .firebaserc: Firebase project settings (project ID: optic-d2702)
- data-model.md: every collection and field
- docs/BentoERD.pdf: the ERD (editable source: docs/BentoERD.drawio)
- scripts/: the seed script that loads sample data into the emulators (see scripts/README.md)
- test/config.test.mjs and firestore.rules.test.mjs: tests

## Run it locally

Local development uses the **Firebase emulators**, so test accounts and data stay on your laptop and never reach the real project.

You need Node 22. If `node -v` shows another version, run this in the terminal first (it lasts for that terminal only):

    export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

1. Install once: `npm ci`
2. Terminal 1, start the emulators (dashboard at http://127.0.0.1:4000):

        npx firebase emulators:start --project optic-d2702

3. Terminal 2, load the sample data:

        node scripts/seed.mjs

4. Terminal 3, serve the app, then open http://localhost:5500/profile.html:

        python3 -m http.server 5500

Notes:

- Open the app from `localhost`. From any other address it uses the real project.
- Port 5000 is taken by AirPlay on a Mac, so the app is served on 5500.
- Stopping the emulators throws away all local data. Run the seed script again to get it back.
- The emulator does not send real emails. Log in with a seeded account (listed in scripts/README.md) or find the verification link in the dashboard under Authentication.

## Tests

- `npm test`: quick checks, no emulator needed
- `npm run test:rules`: the Firestore rules tests. It starts its own emulator, so close `firebase emulators:start` first because they share a port.

Run `npm run test:rules` whenever you change firestore.rules.

## Deploying

Only after the pull request is merged into `main`:

    git checkout main && git pull
    npx firebase-tools deploy --only firestore:rules

firebase.json has no hosting section on purpose, so a deploy cannot publish the whole repo. Compare firestore.indexes.json with the Firebase console (Firestore, Indexes) before deploying indexes.

## Team workflow

One branch per task, and nobody pushes straight to `main`:

    git checkout main
    git pull
    git checkout -b feature/short-name
    # work, commit often
    git push -u origin feature/short-name

Then open a pull request on GitHub. One teammate tries the branch and approves it before it is merged.

- Commit small pieces that each do one thing.
- Start commit messages with a verb: "Add business profile form", "Fix price showing NaN". Not "update" or "stuff".
- Check field names against data-model.md.