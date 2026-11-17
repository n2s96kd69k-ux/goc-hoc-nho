# Cloudflare dashboard deployment

1. Set Production variables: FIREBASE_PROJECT_ID=goc-hoc-48ad4 and FIREBASE_WEB_API_KEY=AIzaSyDvFrAbTZM3JXNyQYp6_q4L-STw5tjm3M4. The latter is the existing public Firebase web config key, not a service-account secret.
2. Set FIREBASE_SERVICE_ACCOUNT as a **Secret**, containing the complete JSON for the dedicated Cloud Datastore User service account. Never commit this JSON.
3. Run npm run build:worker if source changed. Paste the entire worker/worker.js into Cloudflare Edit code, replacing Hello World, then Deploy.
4. Visit /health: expect ok=true, configured=true, walletMigrationEnabled=false. This checks variable presence, not successful service-account authentication.

POST /api/economy requires Authorization: Bearer <Firebase ID token> and JSON body accepted by server/economy.cjs. Identity Toolkit verifies the token; current Firestore role/status is checked in the transaction. The Firestore REST adapter uses service-account OAuth credentials and retries ABORTED transactions up to four attempts. No anonymous database diagnostic endpoint is exposed.

The API supports buy/admin-add/admin-set for already migrated wallets. It DOES NOT create wallets or migrate users. The live frontend is not wired to it. Focus/task/weekly/streak commands are not implemented. Keep canonical wallets absent until those commands and frontend adapters are ready, since existing Rules freeze legacy state when a canonical wallet exists.

Tests: unit tests/mock HTTP authentication plus existing economy transaction fixture. Actual OAuth exchange, Firestore REST transport against production and Cloudflare runtime compatibility must be verified after deployment. No private credentials were used in local tests. /health alone does not prove that Firestore credentials work.
