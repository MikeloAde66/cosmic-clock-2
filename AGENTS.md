<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Working rules (set by the owner)

- Never change what is already working. Add new things beside it; do not rework, rename or migrate existing, working code, settings, projects, domains or deploy setups.
- New features ship through the existing pipeline: a route in this app (like `app/flight-school`), deployed by the existing `cosmic-clock` Vercel project. Do not create new Vercel projects, domains or hosting setups unless the owner asks.
- Never push to `main` and never open a PR unless asked. `main` deploys to aione.protolabsglobal.com, including live Stripe plans.
- Do not change mid-stream. If a plan is working, finish it. If it is not, stop and say so before switching approach.
- Before asking the owner to do something in a dashboard, check whether the work can be done inside the repo instead.
