**1. Local Server Setup**
Navigate to the project, create the data directory, and start the Node.js application:

```bash
cd phil-this
mkdir -p ~/phil-this-data
DATA_DIR=$HOME/phil-this-data PORT=4173 node app/server.js

```

**2. Cloudflare Tunnel**
In a separate terminal pane, expose the local server to the internet:

```bash
~/bin/cloudflared tunnel --url http://localhost:4173

```
