# Shared header and navigation

Every page uses the same header so Bento looks consistent (NFR-1.1).
On desktop the links sit in the header; on phones they move to a bottom tab bar.

## Add it to a page

```html
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Figtree:wght@400;600;700&display=swap">
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/header.css">
</head>
<body>
  <div id="site-header"></div>
  <main id="main" class="page">
    <!-- page content -->
  </main>
  <script type="module" src="js/components/header.js"></script>
</body>
```

That's all — the script fills in `#site-header`, highlights the current page,
and shows the user's initials (or a "Log in" button when signed out).

## What the nav shows

| Role (`users/{uid}.role`) | Links |
|---|---|
| student / signed out | Discover, Events, Favorites, Messages |
| owner | + My listings |
| organization | + My events |
| admin | + Reports |

Firebase is imported from `js/firebase.js` (SDK 12.0.0). Keep the same version in every import.

Change the links in `js/utils/nav.js`. Page file names assumed: `index.html`,
`events.html`, `favorites.html`, `messages.html`, `my-listings.html`,
`my-events.html`, `admin-reports.html`, `profile.html`, `login.html`.
Rename them there if your pages use different names.

## Shared styles

`css/base.css` holds the colors, fonts, buttons (`.btn`, `.btn--quiet`, `.btn--small`)
and form fields (`.field`). Use these instead of new styles so pages match.

## Tests

```bash
npm test
```

Uses Node's built-in test runner (Node 18+), no installs needed.
