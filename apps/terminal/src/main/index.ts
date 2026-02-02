import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Store from 'electron-store';
import * as vfd from './vfd';

// Initialize store for settings
const store = new Store({
  defaults: {
    apiUrl: 'https://kebab-posbackend-production.up.railway.app',
    kioskMode: false,
    printerEnabled: true,
    printerName: 'Element_RW973_Mk',
    vfdEnabled: false,
    vfdPort: '/dev/ttyUSB0',
    vfdBaudRate: 9600,
  },
});

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const isKiosk = store.get('kioskMode') as boolean;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    fullscreen: isKiosk,
    kiosk: isKiosk,
    autoHideMenuBar: isKiosk,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../renderer/assets/icon.png'),
  });

  // In development, load from Vite dev server
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:3004');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create menu (hidden in kiosk mode)
  if (!isKiosk) {
    const menu = Menu.buildFromTemplate([
      {
        label: 'File',
        submenu: [
          {
            label: 'Toggle Kiosk Mode',
            accelerator: 'F11',
            click: () => toggleKioskMode(),
          },
          {
            label: 'Toggle DevTools',
            accelerator: 'F12',
            click: () => mainWindow?.webContents.toggleDevTools(),
          },
          { type: 'separator' },
          { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
        ],
      },
    ]);
    Menu.setApplicationMenu(menu);
  }
}

function toggleKioskMode() {
  if (!mainWindow) return;

  const isFullScreen = mainWindow.isFullScreen();
  mainWindow.setFullScreen(!isFullScreen);
  mainWindow.setKiosk(!isFullScreen);
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('get-settings', () => {
  return {
    apiUrl: store.get('apiUrl'),
    kioskMode: store.get('kioskMode'),
    printerEnabled: store.get('printerEnabled'),
    printerName: store.get('printerName'),
    vfdEnabled: store.get('vfdEnabled'),
    vfdPort: store.get('vfdPort'),
    vfdBaudRate: store.get('vfdBaudRate'),
  };
});

ipcMain.handle('set-settings', (_, settings: Record<string, any>) => {
  Object.entries(settings).forEach(([key, value]) => {
    store.set(key, value);
  });
  return true;
});

ipcMain.handle('toggle-fullscreen', () => {
  toggleKioskMode();
  return mainWindow?.isFullScreen();
});

ipcMain.handle('get-app-info', () => {
  return {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
  };
});

// Get list of available printers from CUPS
ipcMain.handle('get-printers', async () => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Get list of printers
    const { stdout } = await execAsync('lpstat -p');
    
    // Parse printer names from output
    // Format: "printer PrinterName is idle/printing..."
    const lines = stdout.split('\n').filter((line: string) => line.startsWith('printer '));
    const printers = lines.map((line: string) => {
      const match = line.match(/^printer (\S+)/);
      return match ? match[1] : null;
    }).filter(Boolean);
    
    return { success: true, printers };
  } catch (error: any) {
    console.error('Error getting printers:', error);
    return { success: false, printers: [], error: error.message };
  }
});

// Get print queue status
ipcMain.handle('get-print-queue', async () => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Get print queue
    const { stdout } = await execAsync('lpstat -o');
    
    // Parse queue
    const lines = stdout.trim().split('\n').filter((line: string) => line.length > 0);
    const jobs = lines.map((line: string) => {
      // Format: "PrinterName-jobid user size date time"
      const parts = line.split(/\s+/);
      return {
        job: parts[0],
        user: parts[1],
        size: parts[2],
        date: parts.slice(3).join(' ')
      };
    });
    
    return { success: true, jobs };
  } catch (error: any) {
    // Empty queue returns error, that's normal
    if (error.message.includes('No entries')) {
      return { success: true, jobs: [] };
    }
    console.error('Error getting print queue:', error);
    return { success: false, jobs: [], error: error.message };
  }
});

// Print via ESC/POS (if printer connected directly to terminal)
ipcMain.handle('print-receipt', async (_, orderData: any) => {
  try {
    console.log('Print request received:', orderData);
    
    // Check if printer is enabled
    if (!store.get('printerEnabled')) {
      console.log('Printer disabled in settings');
      return { success: true }; // Still return success to not block order completion
    }

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Check if this is a kitchen docket
    const isKitchen = orderData.paymentMethod === 'kitchen';
    
    // Build ESC/POS commands
    const commands: number[] = [];
    
    // Helper to add text
    const addText = (text: string) => {
      for (let i = 0; i < text.length; i++) {
        commands.push(text.charCodeAt(i));
      }
    };
    
    // Helper to add raw bytes
    const addBytes = (...bytes: number[]) => {
      commands.push(...bytes);
    };
    
    // ESC/POS Commands
    const ESC = 0x1B;
    const GS = 0x1D;
    const LF = 0x0A;
    
    // Helper to format order type for display
    const formatOrderType = (type: string | undefined): string => {
      if (!type) return 'TAKEAWAY';
      const normalized = type.toLowerCase().replace(/_/g, '-');
      const typeMap: Record<string, string> = {
        'dine-in': 'DINE IN',
        'dine_in': 'DINE IN',
        'takeaway': 'TAKEAWAY',
        'delivery': 'DELIVERY',
        'online': 'ONLINE',
      };
      return typeMap[normalized] || type.toUpperCase().replace(/[-_]/g, ' ');
    };
    
    // Initialize printer
    addBytes(ESC, 0x40);
    
    if (isKitchen) {
      // KITCHEN DOCKET FORMAT
      // Center align
      addBytes(ESC, 0x61, 0x01);
      // Double width & height
      addBytes(ESC, 0x21, 0x30);
      addText('KITCHEN ORDER');
      addBytes(LF, LF);
      
      // Normal size
      addBytes(ESC, 0x21, 0x00);
      // Left align
      addBytes(ESC, 0x61, 0x00);
      addText('================================');
      addBytes(LF);
      
      // Large order number
      addBytes(ESC, 0x21, 0x30); // Double width & height
      addText(`#${orderData.orderNumber}`);
      addBytes(LF);
      
      // Normal size
      addBytes(ESC, 0x21, 0x00);
      addText('================================');
      addBytes(LF);
      addText(`Time: ${new Date().toLocaleTimeString()}`);
      addBytes(LF);
      
      // Order type - fix undefined issue
      const orderType = formatOrderType(orderData.orderType || orderData.type);
      addText(`Type: ${orderType}`);
      addBytes(LF);
      
      if (orderData.customerName) {
        addText(`Customer: ${orderData.customerName}`);
        addBytes(LF);
      }
      addText('--------------------------------');
      addBytes(LF, LF);
      
      // Items - larger and clearer for kitchen
      if (orderData.items && orderData.items.length > 0) {
        orderData.items.forEach((item: any) => {
          const quantity = item.quantity || 1;
          const name = item.name || item.product?.name || 'Item';
          
          // Double height for item names
          addBytes(ESC, 0x21, 0x10);
          addText(`${quantity}x ${name}`);
          addBytes(LF);
          
          // Normal size for modifiers
          addBytes(ESC, 0x21, 0x00);
          
          if (item.modifiers && item.modifiers.length > 0) {
            item.modifiers.forEach((mod: any) => {
              addText(`  >> ${mod.name}`);
              addBytes(LF);
            });
          }
          
          if (item.notes) {
            addText(`  ** ${item.notes} **`);
            addBytes(LF);
          }
          addBytes(LF);
        });
      }
      
      addText('================================');
      addBytes(LF);
      // Center align
      addBytes(ESC, 0x61, 0x01);
      addText('-- KITCHEN COPY --');
      addBytes(LF);
      
    } else {
      // CUSTOMER RECEIPT FORMAT
      
      // Try to print logo image
      const logoPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'assets', 'logo.png')
        : path.join(__dirname, '../../assets/logo.png');
      
      if (fs.existsSync(logoPath)) {
        try {
          // Use escpos to print image
          const escpos = require('escpos');
          const Image = require('escpos').Image;
          
          // Load and convert image to ESC/POS raster format
          const image = await new Promise<any>((resolve, reject) => {
            Image.load(logoPath, (img: any) => {
              if (img) resolve(img);
              else reject(new Error('Failed to load image'));
            });
          });
          
          // Center align for logo
          addBytes(ESC, 0x61, 0x01);
          
          // Get raster image data
          const raster = image.toRaster();
          const width = raster.width;
          const height = raster.height;
          const data = raster.data;
          
          // GS v 0 - Print raster bit image
          const xL = width & 0xFF;
          const xH = (width >> 8) & 0xFF;
          const yL = height & 0xFF;
          const yH = (height >> 8) & 0xFF;
          
          addBytes(GS, 0x76, 0x30, 0x00, xL, xH, yL, yH);
          for (let i = 0; i < data.length; i++) {
            commands.push(data[i]);
          }
          addBytes(LF);
        } catch (imgError) {
          console.log('Could not print logo image:', imgError);
          // Fallback to text header
          addBytes(ESC, 0x61, 0x01);
          addBytes(ESC, 0x21, 0x30);
          addText('AL TAHER');
          addBytes(LF);
          addBytes(ESC, 0x21, 0x00);
          addText('KEBABS & SWEETS');
          addBytes(LF);
        }
      } else {
        console.log('Logo not found at:', logoPath);
        // Fallback to text header
        addBytes(ESC, 0x61, 0x01);
        addBytes(ESC, 0x21, 0x30);
        addText('AL TAHER');
        addBytes(LF);
        addBytes(ESC, 0x21, 0x00);
        addText('KEBABS & SWEETS');
        addBytes(LF);
      }
      
      // Business details (centered)
      addBytes(ESC, 0x61, 0x01);
      addBytes(LF);
      addText('Shop 7a/22 Mawson Pl,');
      addBytes(LF);
      addText('Mawson ACT 2607');
      addBytes(LF, LF);
      addText('ALTAHER Proprietary Limited');
      addBytes(LF);
      addText('ABN: 79 689 402 051');
      addBytes(LF);
      
      addBytes(LF);
      
      // Left align
      addBytes(ESC, 0x61, 0x00);
      addText('================================');
      addBytes(LF);
      
      // Center align for order info
      addBytes(ESC, 0x61, 0x01);
      
      // Order type - fix undefined issue
      const orderType = formatOrderType(orderData.orderType || orderData.type);
      addBytes(ESC, 0x21, 0x10); // Double height
      addText(orderType);
      addBytes(LF);
      
      // Large order number - BIGGER
      addBytes(ESC, 0x21, 0x30); // Double width & height
      addText(`#${orderData.orderNumber}`);
      addBytes(LF);
      
      // Normal size
      addBytes(ESC, 0x21, 0x00);
      addBytes(LF);
      
      // Left align for details
      addBytes(ESC, 0x61, 0x00);
      addText(`Date: ${new Date().toLocaleString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`);
      addBytes(LF);
      if (orderData.customerName && orderData.customerName !== 'Guest') {
        addText(`Customer: ${orderData.customerName}`);
        addBytes(LF);
      }
      addText('--------------------------------');
      addBytes(LF);
      
      // Add items
      if (orderData.items && orderData.items.length > 0) {
        orderData.items.forEach((item: any) => {
          const quantity = item.quantity || 1;
          const name = item.name || item.product?.name || 'Item';
          const price = item.totalPrice || item.price || item.unitPrice || 0;
          
          addText(`${quantity}x ${name}`);
          addBytes(LF);
          addText(`   $${price.toFixed(2)}`);
          addBytes(LF);
          
          if (item.modifiers && item.modifiers.length > 0) {
            item.modifiers.forEach((mod: any) => {
              const modPrice = mod.price || 0;
              if (modPrice > 0) {
                addText(`   + ${mod.name} ($${modPrice.toFixed(2)})`);
              } else {
                addText(`   + ${mod.name}`);
              }
              addBytes(LF);
            });
          }
          
          if (item.notes) {
            addText(`   Note: ${item.notes}`);
            addBytes(LF);
          }
        });
      }
      
      addText('--------------------------------');
      addBytes(LF);
      addText(`Subtotal: $${(orderData.subtotal || 0).toFixed(2)}`);
      addBytes(LF);
      addText(`GST: $${(orderData.tax || 0).toFixed(2)}`);
      addBytes(LF);
      
      // Bold and larger total
      addBytes(ESC, 0x21, 0x18); // Bold + double height
      addText(`TOTAL: $${(orderData.total || 0).toFixed(2)}`);
      addBytes(LF);
      addBytes(ESC, 0x21, 0x00); // Normal
      
      addText('--------------------------------');
      addBytes(LF);
      
      // Payment method
      const paymentMethod = orderData.paymentMethod || 'CASH';
      addText(`Paid by: ${paymentMethod.toUpperCase()}`);
      addBytes(LF, LF);
      
      // Center align for footer
      addBytes(ESC, 0x61, 0x01);
      addText('Thank you for your order!');
      addBytes(LF);
      addText('See you again soon');
      addBytes(LF, LF);
      
      // Print QR codes
      const reviewQrPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'assets', 'review_qrcode.png')
        : path.join(__dirname, '../../assets/review_qrcode.png');
      
      const menuQrPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'assets', 'menu_qrcode.png')
        : path.join(__dirname, '../../assets/menu_qrcode.png');
      
      try {
        const escpos = require('escpos');
        const Image = require('escpos').Image;
        
        // Print Review QR Code
        if (fs.existsSync(reviewQrPath)) {
          const reviewImage = await new Promise<any>((resolve, reject) => {
            Image.load(reviewQrPath, (img: any) => {
              if (img) resolve(img);
              else reject(new Error('Failed to load review QR'));
            });
          });
          
          addText('If you enjoyed your meal,');
          addBytes(LF);
          addText("we'd love a review!");
          addBytes(LF);
          
          const reviewRaster = reviewImage.toRaster();
          const rxL = reviewRaster.width & 0xFF;
          const rxH = (reviewRaster.width >> 8) & 0xFF;
          const ryL = reviewRaster.height & 0xFF;
          const ryH = (reviewRaster.height >> 8) & 0xFF;
          
          addBytes(GS, 0x76, 0x30, 0x00, rxL, rxH, ryL, ryH);
          for (let i = 0; i < reviewRaster.data.length; i++) {
            commands.push(reviewRaster.data[i]);
          }
          addBytes(LF, LF);
        }
        
        // Print Menu QR Code
        if (fs.existsSync(menuQrPath)) {
          const menuImage = await new Promise<any>((resolve, reject) => {
            Image.load(menuQrPath, (img: any) => {
              if (img) resolve(img);
              else reject(new Error('Failed to load menu QR'));
            });
          });
          
          addText('Scan to view our');
          addBytes(LF);
          addText('full menu online:');
          addBytes(LF);
          
          const menuRaster = menuImage.toRaster();
          const mxL = menuRaster.width & 0xFF;
          const mxH = (menuRaster.width >> 8) & 0xFF;
          const myL = menuRaster.height & 0xFF;
          const myH = (menuRaster.height >> 8) & 0xFF;
          
          addBytes(GS, 0x76, 0x30, 0x00, mxL, mxH, myL, myH);
          for (let i = 0; i < menuRaster.data.length; i++) {
            commands.push(menuRaster.data[i]);
          }
          addBytes(LF);
        }
      } catch (qrError) {
        console.log('Could not print QR codes:', qrError);
      }
    }
    
    // Feed and cut - extra lines for tear-off
    addBytes(LF, LF, LF, LF, LF, LF, LF, LF);
    addBytes(GS, 0x56, 0x00); // Full cut
    
    // Write to temporary file
    const tmpFile = path.join(require('os').tmpdir(), 'receipt.bin');
    fs.writeFileSync(tmpFile, Buffer.from(commands));
    
    // Print using lp command to CUPS printer
    const printerName = store.get('printerName') || 'Element_RW973_Mk';
    await execAsync(`lp -d ${printerName} -o raw ${tmpFile}`);
    
    // Clean up
    fs.unlinkSync(tmpFile);
    
    console.log('Receipt printed successfully');
    return { success: true };
  } catch (error: any) {
    console.error('Print error:', error);
    return { success: false, error: error.message };
  }
});

// ============================================
// VFD Customer Display IPC Handlers
// ============================================

// Initialize VFD on app start if enabled
app.whenReady().then(async () => {
  const vfdEnabled = store.get('vfdEnabled') as boolean;
  if (vfdEnabled) {
    const vfdPort = store.get('vfdPort') as string;
    const vfdBaudRate = store.get('vfdBaudRate') as number;
    console.log(`[VFD] Auto-connecting to ${vfdPort}...`);
    await vfd.initVFD(vfdPort, vfdBaudRate);
  }
});

// Connect to VFD
ipcMain.handle('vfd-connect', async (_, portPath?: string, baudRate?: number) => {
  const port = portPath || (store.get('vfdPort') as string);
  const baud = baudRate || (store.get('vfdBaudRate') as number);
  return await vfd.initVFD(port, baud);
});

// Disconnect VFD
ipcMain.handle('vfd-disconnect', async () => {
  await vfd.closeVFD();
  return { success: true };
});

// Check VFD status
ipcMain.handle('vfd-status', () => {
  return { connected: vfd.isVFDConnected() };
});

// List available serial ports
ipcMain.handle('vfd-list-ports', async () => {
  return await vfd.listSerialPorts();
});

// Show welcome message
ipcMain.handle('vfd-welcome', () => {
  vfd.showWelcome();
  return { success: true };
});

// Show item added with price and running total
ipcMain.handle('vfd-item-added', (_, itemName: string, price: number, total: number) => {
  vfd.showItemAdded(itemName, price, total);
  return { success: true };
});

// Show total only
ipcMain.handle('vfd-total', (_, total: number) => {
  vfd.showTotal(total);
  return { success: true };
});

// Clear display
ipcMain.handle('vfd-clear', () => {
  vfd.clearDisplay();
  return { success: true };
});
