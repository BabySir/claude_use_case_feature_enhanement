# Internal Request Hub

Internal Request Hub is a small internal tool for tracking requests that
employees submit and reviewers act on. Employees can view the requests
they've created, reviewers can view requests assigned to them, and
administrators can view all requests across the organization. The
assigned reviewer can approve or reject a submitted request, and the
requester can cancel their own submitted request.

## Technology

- React and Vite
- Node.js and Express
- SQLite
- Node's built-in test runner
- ESLint

## Requirements

- Node.js 22.13 or later (Node 22 LTS recommended)
- npm 10 or later

## Start locally

```bash
npm ci
npm run dev
```

Open <http://localhost:5173>. The API runs on <http://localhost:3001>.

The app creates and seeds `server/data/request-hub.db` on first start.

## Useful commands

```bash
npm run dev       # Start the web app and API
npm test          # Run server and client tests
npm run lint      # Run static checks
npm run build     # Build the React app
npm start         # Run the production server
npm run db:reset  # Delete and recreate the local database
```

## Verify a change locally

GitHub Actions runs lint, tests, and the build on every pull request
(see `.github/workflows/ci.yml`). You can also verify a build locally:

```bash
npm ci
npm run build
npm start        # serves the built client and API together on port 3001
```

Check `/api/health` and the relevant feature in the browser. The SQLite
database persists in `server/data/request-hub.db` between runs, so a
restart does not lose data; use `npm run db:reset` to return to the
seeded state.

## Simulated identity

The user selector represents the current signed-in user. The API
accepts `currentUserId` to apply basic data visibility rules. This is
not production authentication.

## Current behavior

- Employees see requests they created.
- Reviewers see requests assigned to them.
- Administrators see all requests.
- Users can open a request and see its details.
- The requester can cancel their own submitted request.
- The assigned reviewer can approve a submitted request, or reject it
  with a comment.
- Unknown, inactive, or unauthorized users receive a clear API error.
