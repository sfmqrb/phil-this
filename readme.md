                                                                                                           │                                                                                            00:27 [33/33]
~ ❯ cd phil-this                                               smaghrebi@apps0 00:22:59                    │~ ❯ ~/bin/cloudflared tunnel --url http://localhost:4173
❯ cd phil-this                                                                                             │❯ ~/bin/cloudflared tunnel --url http://localhost:4173
❯ mkdir -p ~/phil-this-data                                                                                │2026-08-16T04:26:55Z INF Thank you for trying Cloudflare Tunnel. Doing so, without a Cloudflare account,
DATA_DIR=$HOME/phil-this-data PORT=4173 node app/server.js                                                 │is a quick way to experiment and try it out. However, be aware that these account-less Tunnels have no up
Indexed 245 transcripts for search.                                                                        │time guarantee, are subject to the Cloudflare Online Services Terms of Use (https://www.cloudflare.com/we
(node:2320324) ExperimentalWarning: SQLite is an experimental feature and might change at any time         │bsite-terms/), and Cloudflare reserves the right to investigate your use of Tunnels for violations of suc
(Use `node --trace-warnings ...` to show where the warning was created)                                    │h terms. If you intend to use Tunnels in production you should use a pre-created named tunnel by followin
Philosophize This! quiz app running at http://0.0.0.0:4173/                                                │g: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps
Accounts + scores are stored in /u/smaghrebi/phil-this-data/data.sqlite                                    │2026-08-16T04:26:55Z INF Requesting new quick Tunnel on trycloudflare.com...
                                                                                                           │2026-08-16T04:26:58Z INF +-------------------------------------------------------------------------------
                                                                                                           │-------------+
                                                                                                           │2026-08-16T04:26:58Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be
                                                                                                           │reachable):  |
                                                                                                           │2026-08-16T04:26:58Z INF |  https://cheers-alcohol-bible-horizontal.trycloudflare.com
                                                                                                           │             |
                                                                                                           │2026-08-16T04:26:58Z INF +-------------------------------------------------------------------------------
                                                                                                           │-------------+
                                                                                                           │2026-08-16T04:26:58Z INF Cannot determine default configuration path. No file [config.yml config.yaml] in
                                                                                                           │ [~/.cloudflared ~/.cloudflare-warp ~/cloudflare-warp /etc/cloudflared /usr/local/etc/cloudflared]
                                                                                                           │2026-08-16T04:26:58Z INF Version 2026.8.2 (Checksum fcfb02b575a52ca1af2e3267af4e1517bcdeb30ac48c834c69aba
                                                                                                           │ed3c0576ad2)
