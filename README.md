# Friend Graph

Self-hosted friend network graph. Friend / close friend / acquaintance links, drag people, drag a line onto someone else to re-link it. Sessions autosave to the server.

Zero dependencies (Node 22). Data: `data/sessions/*.json`, plus a rolling `.bak` per session.

## Run
```
cp .env.example .env     # set APP_PASSWORD
docker compose up -d --build
```
Open http://localhost:8085

## Publish
```
git init && git add . && git commit -m "init"
git branch -M main
git remote add origin git@github.com:YOU/friend-graph.git
git push -u origin main
```
`.env` is git-ignored. Actions builds `ghcr.io/YOU/friend-graph:latest`. Make the package public (Package settings > Change visibility), or log the host into ghcr.io.

## TrueNAS SCALE
1. Replace `OWNER` in `docker-compose.truenas.yml`, set the password and data path
2. `chown -R 568:568 <data path>`, and make sure parent folders are traversable by 568
3. Apps > Discover Apps > Install via YAML > paste

## Remote
Tailscale or Cloudflare Tunnel. Don't expose plain HTTP, the password travels as a header.

## Env
| var | default | meaning |
|---|---|---|
| APP_PASSWORD | empty | empty disables login |
| HOST_PORT | 8085 | host port |
| DATA_PATH | ./data | host dir for sessions |
| PUID / PGID | 568 | container user |
| IMAGE | ghcr.io/OWNER/friend-graph:latest | image name |
