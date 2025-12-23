# tombola.freeinfo.it deploy

## Quick start
```bash
unzip tombola.freeinfo.it-deploy.zip
cd tombola.freeinfo.it
./scripts/init-letsencrypt.sh
```

## Notes
- App is built from `app/` (server + client build).
- Nginx terminates TLS and proxies to the app on port 8080.
