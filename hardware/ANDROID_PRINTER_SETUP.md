# 🖨️ Connecting Android Kiosk to Printer

Since your Kiosk is on an Android Tablet and your Printer is on a Computer (Mac/PC), they cannot talk directly using `localhost`.

Also, because the Website is **HTTPS** (Secure), it cannot talk to **HTTP** (Insecure) local IP addresses.

**The Solution**: Use **ngrok** to create a secure tunnel.

## 1. Install Ngrok (On the Computer with the Printer)
1.  Go to [ngrok.com](https://ngrok.com) and sign up (free).
2.  Install ngrok on your Mac:
    ```bash
    brew install ngrok/ngrok/ngrok
    ```
    *(Or download the zip from their website)*.
3.  Connect your account (copy command from ngrok dashboard):
    ```bash
    ngrok config add-authtoken YOUR_TOKEN
    ```

## 2. Start the Tunnel
1.  Ensure your **Hardware Bridge** is running (`npx tsx server.ts`).
2.  In a **new terminal window**, run:
    ```bash
    ngrok http 8080
    ```
3.  Copy the **Forwarding URL** that looks like: `https://a1b2-c3d4.ngrok-free.app`

## 3. Configure the Android Tablet
1.  Open your Kiosk App: `https://uqms-5qqa.vercel.app/kiosk`
2.  **Tap the bottom-right corner** of the screen (it's a hidden button).
3.  A settings box will appear.
4.  Paste your **Ngrok URL** (e.g., `https://a1b2-c3d4.ngrok-free.app`). **Do not add `/print` at the end**.
5.  Click **Save**.

## 4. Test
Tap a Faculty button. The tablet sends the request to Ngrok -> Your Mac -> Your Printer. Service verified!
