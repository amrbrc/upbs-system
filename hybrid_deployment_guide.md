# UP Bikeshare: Cheap & Free Live Deployment Options

Since this system interfaces with physical hardware (the GSM USB modem), the component that interacts with the modem (the **Gateway Server**) must run on the local physical computer where the USB modem is plugged in. 

However, you can make the system live so other people can access it for **free ($0/month)** using either of the two methods below.

---

## ⚡ Method 1: Instant Live Server via Cloudflare Tunnel (100% Free)

This method lets you turn your **current local machine** (where the USB modem is plugged in) into a live server that anyone in the world can access. You do not need to move your database or pay for a cloud provider.

### How It Works:
1. You run a helper tool from Cloudflare called `cloudflared` on your local hardware.
2. It establishes a secure, outbound-only tunnel to Cloudflare.
3. Users visit a public URL, and Cloudflare routes their requests down the tunnel to port `3001` on your local machine.

```
[ User Browsers (Public Internet) ]
               │
               ▼ (HTTPS request)
         [ Cloudflare ]
               │
               ▼ (Secure Tunnel Pipe)
  [ Your Local Physical Server ] ────► [ Worker API & Dashboard (Port 3001) ]
               ▲
               │ (Localhost request)
  [ Gateway Server (Port 3000) ] ◄───► [ Gammu Database & GSM Modem ]
```

### Step-by-Step Setup:

1. **Install the `cloudflared` package:**
   Since you already have the `cloudflared.deb` package downloaded in the project directory, run this command:
   ```bash
   sudo dpkg -i cloudflared.deb
   ```

2. **Verify the installation:**
   ```bash
   cloudflared --version
   ```

3. **Start the tunnel:**
   Launch a temporary quick tunnel pointing to the Worker API & Dashboard on port `3001`:
   ```bash
   cloudflared tunnel --url http://localhost:3001
   ```

4. **Access the Application:**
   In your terminal output, look for a box containing a URL like:
   ```text
   https://your-unique-tunnel-name.trycloudflare.com
   ```
   Anyone can open this URL on their browser (on mobile or desktop) to access the dashboard live.

> [!NOTE]
> The quick tunnel URL changes every time you restart the command. If you want a permanent URL (like `https://upbikeshare.org`), you will need to buy a cheap domain ($2–$10/year) and link it using the configuration described in deployment_guide.md.

---

## ☁️ Method 2: True Hybrid Setup (Cloud Hosting + Local Modem)

If you want the student and admin dashboard to be highly stable and always online—even if your local hardware is turned off, loses power, or restarts—you can host the backend API and database in the cloud for free.

### How It Works:
1. The **Worker API**, **Web Dashboard**, and **MySQL Database** are deployed to a free cloud hosting provider.
2. The **Gateway Server** runs locally on the physical machine where the GSM USB modem is plugged in.
3. The local Gateway Server forwards incoming SMS commands to the cloud-hosted Worker API over the internet.

```
           [ User Browsers ]
                   │
                   ▼ (HTTPS)
   [ Cloud Server (Render/Railway/VPS) ] ◄─── (SMS JSON Payload)
   [ Worker API, Dashboard, & MySQL DB ]                      │
                   ▲                                          │
                   │ (HTTP Responses)                         │
                   └──────────────────────────────────────────┼───┐
                                                              │   │
  [ Your Local Machine ]                                      │   │
  [ Gateway Server (Port 3000) ] ─────────────────────────────┘   │
                   ▲                                              │
                   │ (Pulls incoming / Injects outgoing SMS)      │
         [ GSM USB Modem / Gammu ] ◄──────────────────────────────┘
```

### Step-by-Step Setup:

1. **Host the Database in the Cloud ($0/month):**
   * Create a free account on [Render](https://render.com) or [Railway](https://railway.app).
   * Spin up a free PostgreSQL or MySQL database instance.
   * Import your `upbs` schema and default configuration parameters.

2. **Deploy the Worker API ($0/month):**
   * Push your codebase to a private repository on GitHub.
   * On Render or Railway, create a new **Web Service** and connect it to your GitHub repository.
   * Set the **Build Command** to `npm install` and **Start Command** to `node worker-api/server.js` (listening on port 3001).
   * In the hosting provider's dashboard, configure the environment variables from your `worker-api/.env` file, replacing the database connection details with your cloud database's credentials.
   * Once built, you will get a permanent public HTTPS URL, for example:
     `https://upbs-worker.onrender.com`

3. **Reconfigure and Run the Local Gateway Server:**
   * On your local machine (where the GSM modem is plugged in), open `gateway-server/.env`.
   * Change `WORKER_URL` to point to your new cloud service:
     ```env
     WORKER_URL=https://upbs-worker.onrender.com
     ```
   * Start your local gateway server:
     ```bash
     node gateway-server/server.js
     ```

### Benefits of the Hybrid Approach:
* **High Availability:** The Web Dashboard never goes down when you turn off or restart the local machine.
* **Resiliency:** If your local machine goes offline, SMS messages sent by users will queue up on the SIM card/modem. As soon as the machine is powered back on and the gateway starts, the messages are fetched and processed.
