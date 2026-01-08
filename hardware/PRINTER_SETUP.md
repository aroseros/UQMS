# 🖨️ Kiosk Printer Setup Guide

Your UQMS Kiosk is designed to work with standard **EPSON-compatible Thermal Printers** (commonly used for POS receipts).

## 1. Connect the Printer
1.  Connect your thermal printer to your computer via **USB**.
2.  **Turn it on**.
3.  Ensure you have paper loaded.

## 2. Install Drivers (System Level)
The bridge relies on your operating system's printer subsystem.
*   **Mac**: Add the printer in **System Settings > Printers & Scanners**. Make sure it's set as the **Default Printer** (or note its name).
*   **Windows**: Install the driver and ensure it appears in "Printers & Scanners".

## 3. Configure the Bridge
By default, the system runs in "Mock Mode" to save paper during development. To enable the real printer:

1.  Open the `uqms/hardware` folder.
2.  Create a file named `.env`.
3.  Add the following line:
    ```bash
    PRINTER_ENABLED=true
    ```

## 4. Restart the Bridge
In your terminal where the hardware bridge is running:
1.  Stop the server (`Ctrl+C`).
2.  Restart it:
    ```bash
    npx tsx server.ts
    ```

## Troubleshooting
If the printer doesn't print:
1.  **Check Connection**: Ensure the printer is visible in your OS settings.
2.  **Interface Config**:
    Open `uqms/hardware/server.ts` and look for `ThermalPrinterAdapter`.
    Current setting: `interface: 'printer:auto'` (Tries to use the OS default printer).
    
    *   **If you know the printer name**: Change to `interface: 'printer:My_Printer_Name'`.
    *   **Network Printer**: Use `interface: 'tcp://192.168.x.x'`.
