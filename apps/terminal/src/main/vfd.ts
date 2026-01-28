/**
 * VFD (Vacuum Fluorescent Display) Customer Display Service
 * Simplified for VFD2205 ESC/POS display
 * 
 * Two states:
 * 1. Welcome: "Al-Taher Kebabs" / "Welcome!"
 * 2. Total: "TOTAL" / "$XX.XX"
 */

import { SerialPort } from 'serialport';

const VFD_WIDTH = 20;

let port: SerialPort | null = null;
let isConnected = false;
let isWriting = false;
let pendingWrite: { line1: string; line2: string } | null = null;

/**
 * Initialize VFD connection
 */
export async function initVFD(portPath: string = '/dev/ttyUSB0', baudRate: number = 9600): Promise<{ success: boolean; error?: string }> {
  try {
    if (port && port.isOpen) {
      await closeVFD();
    }

    port = new SerialPort({
      path: portPath,
      baudRate: baudRate,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      autoOpen: false,
    });

    return new Promise((resolve) => {
      port!.open((err) => {
        if (err) {
          console.error('[VFD] Failed to open port:', err.message);
          isConnected = false;
          resolve({ success: false, error: err.message });
          return;
        }

        isConnected = true;
        isWriting = false;
        pendingWrite = null;
        console.log(`[VFD] Connected to ${portPath} at ${baudRate} baud`);

        // Initialize and show welcome after a delay
        setTimeout(() => {
          showWelcome();
        }, 300);

        resolve({ success: true });
      });

      port!.on('error', (err) => {
        console.error('[VFD] Serial error:', err.message);
        isConnected = false;
      });

      port!.on('close', () => {
        console.log('[VFD] Port closed');
        isConnected = false;
      });
    });
  } catch (error: any) {
    console.error('[VFD] Init error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Close VFD connection
 */
export async function closeVFD(): Promise<void> {
  isWriting = false;
  pendingWrite = null;
  
  if (port && port.isOpen) {
    return new Promise((resolve) => {
      port!.close((err) => {
        if (err) {
          console.error('[VFD] Error closing port:', err.message);
        }
        port = null;
        isConnected = false;
        resolve();
      });
    });
  }
}

/**
 * Check if VFD is connected
 */
export function isVFDConnected(): boolean {
  return isConnected && port !== null && port.isOpen;
}

/**
 * Center text on a line
 */
function centerText(text: string): string {
  const clean = text.substring(0, VFD_WIDTH);
  const padding = Math.floor((VFD_WIDTH - clean.length) / 2);
  return ' '.repeat(padding) + clean + ' '.repeat(VFD_WIDTH - padding - clean.length);
}

/**
 * Pad text to full width
 */
function padLine(text: string): string {
  return text.substring(0, VFD_WIDTH).padEnd(VFD_WIDTH, ' ');
}

/**
 * Write two lines to display with proper sequencing
 */
function writeDisplay(line1: string, line2: string): void {
  if (!isVFDConnected()) {
    console.log('[VFD] Not connected');
    return;
  }

  const l1 = padLine(line1);
  const l2 = padLine(line2);

  // If currently writing, store as pending (only keep latest)
  if (isWriting) {
    pendingWrite = { line1: l1, line2: l2 };
    return;
  }

  isWriting = true;

  // Build complete message: Clear + Line1 + Line2
  // Using overwrite mode - just send 40 chars starting from home position
  const message = Buffer.concat([
    Buffer.from([0x0C]),              // Clear display (form feed)
    Buffer.from([0x1B, 0x40]),        // Initialize
  ]);

  port!.write(message, () => {
    // After init, wait then write content
    setTimeout(() => {
      // Write both lines as one continuous string (VFD wraps at 20 chars)
      port!.write(l1 + l2, () => {
        port!.drain(() => {
          console.log(`[VFD] "${l1.trim()}" / "${l2.trim()}"`);
          
          // Check for pending write
          setTimeout(() => {
            isWriting = false;
            if (pendingWrite) {
              const pending = pendingWrite;
              pendingWrite = null;
              writeDisplay(pending.line1, pending.line2);
            }
          }, 50);
        });
      });
    }, 50);
  });
}

/**
 * Show welcome message - call when cart is empty
 */
export function showWelcome(): void {
  writeDisplay(centerText('Al-Taher Kebabs'), centerText('Welcome!'));
}

/**
 * Show total amount - call when cart has items
 */
export function showTotal(total: number): void {
  const priceStr = `$${total.toFixed(2)}`;
  writeDisplay(centerText('TOTAL'), centerText(priceStr));
}

/**
 * Clear display
 */
export function clearDisplay(): void {
  if (!isVFDConnected()) return;
  port!.write(Buffer.from([0x0C]));
}

/**
 * List available serial ports
 */
export async function listSerialPorts(): Promise<Array<{ path: string; manufacturer?: string }>> {
  try {
    const ports = await SerialPort.list();
    return ports.map(p => ({
      path: p.path,
      manufacturer: p.manufacturer,
    }));
  } catch (error) {
    console.error('[VFD] Error listing ports:', error);
    return [];
  }
}
