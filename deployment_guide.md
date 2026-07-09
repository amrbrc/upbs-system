# UP Bikeshare Production Deployment Guide

This guide will walk you through deploying the **UP Bikeshare System** on your local hardware and making it securely accessible to the public for **free ($0/month)**.

---

## 🛠️ The Architecture (In Simple Terms)

Since you have physical hardware connected to a GSM USB modem:
1. **Your Server** runs the database, the GSM modem daemon (`gammu-smsd`), the `gateway-server` (port 3000), and the `worker-api` (port 3001).
2. **Your Users** (students/admins) need to access the Web Dashboard. The dashboard files are served by the `worker-api` on port 3001.
3. **Cloudflare Tunnel` acts as a secure, private pipe from the internet directly to port 3001 on your local machine. You don't need to configure router settings, and it provides HTTPS (`https://`) completely for free.

```
[ Student / Admin Browsers ] 
         │
         ▼ (HTTPS request)
   [ Cloudflare ]
         │
         ▼ (Secure Tunnel Pipe)
  [ Your Local Server ] ──► [ Worker API & Dashboard (Port 3001) ] ──► [ MySQL DB ]
         ▲
         │ (HTTP Localhost requests)
  [ Gateway Server (Port 3000) ] ◄──► [ Gammu Database ] ◄──► [ GSM USB Modem ]
```

---

## 📋 Prerequisites

Before we start, make sure you have:
- Linux installed on your hardware server.
- The physical GSM modem plugged into the server.
- MySQL or MariaDB database running.
- Node.js installed.

---

## 🚀 Step 1: Run the Apps in the Background (PM2)

When you run a command like `node server.js` in the terminal, it stops if you close the terminal window or disconnect. To keep the apps running 24/7 in the background, we use a tool called **PM2**.

1. **Install PM2 globally on your server:**
   ```bash
   sudo npm install -g pm2
   ```

2. **Start the services:**
   Navigate to your project root folder and start both services:
   ```bash
   # Start the Gateway Server
   pm2 start gateway-server/server.js --name "upbs-gateway"

   # Start the Worker API & Dashboard
   pm2 start worker-api/server.js --name "upbs-worker"
   ```

3. **Configure Auto-Restart on Boot:**
   If your server power cuts out or restarts, you want the apps to start back up automatically.
   ```bash
   # Generate the startup configuration
   pm2 startup
   ```
   *Note: This command will output another command that looks like `sudo env PATH=...`. Copy and paste that output command into your terminal and run it.*

   Once done, save the current running app list:
   ```bash
   pm2 save
   ```

---

## 🔒 Step 2: Configure Environment Variables

Make sure the configuration files are set up for production. 

1. **Worker API configuration (`worker-api/.env`):**
   Open the file and ensure these values are secure:
   ```env
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=upbs2024
   DB_PASSWORD=your_secure_mysql_password
   
   # Set a custom credentials for system fallbacks
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=change-this-to-a-strong-password
   
   # Internal port communication
   GATEWAY_URL=http://localhost:3000
   GATEWAY_API_KEY=choose-a-long-random-string-here
   JWT_SECRET=choose-another-long-random-string-for-tokens
   ```

2. **Gateway Server configuration (`gateway-server/.env`):**
   Open the file and match the settings:
   ```env
   DB_HOST=127.0.0.1
   WORKER_URL=http://localhost:3001
   GATEWAY_API_KEY=must-match-the-key-configured-in-worker-api
   ```

Whenever you edit `.env` files, restart the apps in PM2 to load the changes:
```bash
pm2 restart all
```

---

## 🌐 Step 3: Expose to the Internet for Free (Cloudflare Tunnel)

To let students access the dashboard, we need to map port 3001 to a public website address. 

We use **Cloudflare Tunnels** because they are free, handle HTTPS certificates automatically, and don't require you to touch router settings or buy a static IP.

### Option A: Using a Domain Name you own (Easiest and Professional)
If you can buy a domain name (like `upbikeshare.org` - domains can be bought for as low as $2 to $10 a year from Namecheap, Cloudflare, etc.):

1. **Set up Cloudflare DNS:**
   Add your domain to a free Cloudflare account. Cloudflare will guide you to update your domain's nameservers.
   
2. **Install `cloudflared` on your local server:**
   ```bash
   # Download the installation file
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   
   # Install it
   sudo dpkg -i cloudflared.deb
   ```

3. **Log in to Cloudflare from your terminal:**
   ```bash
   cloudflared tunnel login
   ```
   *This will print a link. Open the link in a browser, log in, and authorize your domain.*

4. **Create a Tunnel:**
   ```bash
   cloudflared tunnel create upbs-tunnel
   ```
   *Note: This command will generate an ID (e.g., `a1b2c3d4-e5f6...`). Copy this ID.*

5. **Configure the Tunnel:**
   Create a configuration file in your home directory:
   ```bash
   mkdir -p ~/.cloudflared
   nano ~/.cloudflared/config.yml
   ```
   Paste the following configuration (replace `<TUNNEL-ID>` and your domain):
   ```yaml
   tunnel: <TUNNEL-ID>
   credentials-file: /home/stph/.cloudflared/<TUNNEL-ID>.json

   ingress:
     # Routes traffic from your domain to the Worker API & Dashboard
     - hostname: upbikeshare.org
       service: http://localhost:3001
     - service: http_status:404
   ```

6. **Route your Domain to the Tunnel:**
   ```bash
   cloudflared tunnel route dns upbs-tunnel upbikeshare.org
   ```

7. **Run the Tunnel as a Background Service:**
   ```bash
   # Install the tunnel service
   sudo cloudflared --config /home/stph/.cloudflared/config.yml service install
   
   # Start the service
   sudo systemctl start cloudflared
   sudo systemctl enable cloudflared
   ```

Your dashboard is now live and secure at `https://upbikeshare.org`!

---

### Option B: Quick Public URL (100% Free, No Domain Required)
If you don't have a domain name and want to test it live immediately:

1. **Install `cloudflared`:**
   ```bash
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared.deb
   ```

2. **Start a Quick Tunnel:**
   ```bash
   cloudflared tunnel --url http://localhost:3001
   ```
   *This will output a random URL (like `https://some-words-here.trycloudflare.com`). Anyone in the world can open this link to access your dashboard!*
   
   *Note: This link changes every time you restart the command, making it perfect for development/testing but temporary.*

---

## 📈 Monitoring and Troubleshooting

Here are some helpful commands for monitoring the services:

### 1. View running processes
```bash
pm2 status
```
This shows you if the apps are running, how much memory they are using, and how many times they have restarted.

### 2. Read live logs
```bash
# View all logs
pm2 logs

# View only the Worker API logs
pm2 logs "upbs-worker"

# View only the Gateway logs
pm2 logs "upbs-gateway"
```

### 3. Restarting and stopping
```bash
# Restart the applications
pm2 restart all

# Stop the applications
pm2 stop all
```
