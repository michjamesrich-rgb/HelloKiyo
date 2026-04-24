## Deploy to Cloudflare Pages (free dev hosting)

This MVP is a static site (no build step). Cloudflare Pages can deploy it directly.

### Option A: Connect Git repo (recommended)
1. Create a new Pages project in Cloudflare.
2. Connect this Git repository.
3. Build settings:
   - **Framework preset**: None / Static
   - **Build command**: (empty)
   - **Output directory**: `/` (repo root)
4. Deploy.

### Option B: Direct upload
Upload the repo contents as a static site (ensure `index.html` is at the root).

### Domain
Once deployed, point `hellokiyo.com` to the Pages project using Cloudflare DNS.

