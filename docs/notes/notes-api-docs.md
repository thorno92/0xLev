# Leverage API Key Findings

- Base URL: https://levapi.0xleverage.api
- Auth flow: POST /check_wallet with apikey + user_id (wallet) -> JWT token + trade wallet
- All POST endpoints require JWT in Authorization header AND apikey in body
- Endpoints: /health, /check_wallet, /quote, /sol_balance, /wlcheck, /open, /positions, /close, /pnl, /close_all, /update_sl, /update_tp, /cancel_pending
- The apikey is a shared secret that must NEVER be exposed to the client
- JWT tokens are per-session, per-wallet
