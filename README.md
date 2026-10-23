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
- Access: only verified @student.gsu.edu accounts can use the database, enforced by firestore.rules

## Project layout

- js/firebase-config.js: Firebase setup, exports auth and db
- firestore.rules: Firestore security rules
- firebase.json and .firebaserc: Firebase project settings (project ID: optic-d2702)

## Getting started

1. Clone the repo and open the folder.
2. Sign in to Firebase (you need to be added to the optic-d2702 project):

        npx firebase-tools login

3. Deploy the security rules after changing firestore.rules:

        npx firebase-tools deploy --only firestore:rules

## Team workflow

Work on your own branch and open a pull request. Changes to main need an approved review before merging.
