const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  init:        [ESC, 0x40],
  alignLeft:   [ESC, 0x61, 0x00],
  alignCenter: [ESC, 0x61, 0x01],
  alignRight:  [ESC, 0x61, 0x02],
  boldOn:      [ESC, 0x45, 0x01],
  boldOff:     [ESC, 0x45, 0x00],
  sizeDouble:  [ESC, 0x21, 0x30],
  sizeNormal:  [ESC, 0x21, 0x00],
  feed3:       [ESC, 0x64, 0x03],
  feed5:       [ESC, 0x64, 0x05],
  cut:         [GS,  0x56, 0x42, 0x00],
};

function pad(str, len, right = false) {
  const s = String(str);
  if (right) return s.padStart(len, ' ').substring(0, len);
  return s.padEnd(len, ' ').substring(0, len);
}

function twoCol(left, right, width = 32) {
  const l = String(left);
  const r = String(right);
  const spaces = Math.max(1, width - l.length - r.length);
  return l + ' '.repeat(spaces) + r + '\n';
}

function wrapText(text, width = 32) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if ((current + ' ' + word).length <= width) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function buildReceiptBytes(data) {
  const enc = new TextEncoder();
  const parts = [];
  const p = (arr) => parts.push(new Uint8Array(arr));
  const t = (str) => parts.push(enc.encode(str));

  const RECEIPT_COLS = 32;
  // Some 58mm printers effectively allow ~14 chars at double width.
  const DOUBLE_HEADER_SAFE_COLS = 14;

  const divider  = '================================\n';
  const divider2 = '--------------------------------\n';

  p(CMD.init);

  // Store header
  p(CMD.alignCenter);
  p(CMD.boldOn);
  const storeName = String(data.storeName || '').trim() || 'STORE';
  const useDoubleHeader = storeName.length <= DOUBLE_HEADER_SAFE_COLS;
  if (useDoubleHeader) {
    p(CMD.sizeDouble);
    t(storeName + '\n');
  } else {
    p(CMD.sizeNormal);
    wrapText(storeName, RECEIPT_COLS).forEach(line => t(line + '\n'));
  }
  p(CMD.sizeNormal);
  p(CMD.boldOff);
  if (data.address) t(data.address + '\n');
  if (data.phone)   t('Tel: ' + data.phone + '\n');
  t(divider);

  // Transaction info
  p(CMD.alignLeft);
  t(`OR #   : ${data.orNumber || data.txnId}\n`);
  t(`Date   : ${data.date}\n`);
  t(`Time   : ${data.time}\n`);
  t(`Cashier: ${data.cashierName}\n`);
  t(divider2);

  // Column headers
  t(pad('Item', 18) + pad('Qty', 6) + pad('Amt', 8, true) + '\n');
  t(divider2);

  // Items
  data.items.forEach(item => {
    const label = item.variantName ? `${item.name} (${item.variantName})` : item.name;
    const name  = label.length > 18 ? label.substring(0, 18) : label;
    const qty   = `${item.qty}${item.unit ? ' ' + item.unit : ''}`;  
    const amt   = `P${Number(item.total).toFixed(2)}`;
    t(pad(name, 18) + pad(qty, 6) + pad(amt, 8, true) + '\n');
    t(`  @ P${Number(item.price).toFixed(2)} each\n`);
  });

  t(divider);

  // Totals
  p(CMD.boldOn);
  t(twoCol('SUBTOTAL:', `P${Number(data.total).toFixed(2)}`));
  p(CMD.boldOff);
  const pm = (data.paymentMethod || 'cash').toUpperCase();
  t(twoCol('PAYMENT:', pm));
  if (pm === 'CASH') {
    if (data.cash != null)   t(twoCol('CASH:',   `P${Number(data.cash).toFixed(2)}`));
    if (data.change != null) t(twoCol('CHANGE:', `P${Number(data.change).toFixed(2)}`));
  }

  // Customer details
  if (data.customer?.name || data.customer?.contact || data.customer?.address) {
    t(divider2);
    t('Customer:\n');
    if (data.customer.name)    t(`  Name: ${data.customer.name}\n`);
    if (data.customer.contact) t(`  Tel : ${data.customer.contact}\n`);
    if (data.customer.address) t(`  Addr: ${data.customer.address}\n`);
  }

  t(divider);

  // Footer
  p(CMD.alignCenter);
  const footerText = data.footer || data.receiptFooter || 'Salamat sa inyong pagbili!';
  t(footerText + '\n');
  p(CMD.feed5);
  p(CMD.cut);

  // Merge
  const byteLen = parts.reduce((s, chunk) => s + chunk.length, 0);
  const result = new Uint8Array(byteLen);
  let offset = 0;
  parts.forEach(chunk => { result.set(chunk, offset); offset += chunk.length; });
  return result;
}

// Known BLE service/characteristic UUIDs for generic ESC/POS printers
const BLE_PROFILES = [
  { service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', characteristic: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' },
  { service: '000018f0-0000-1000-8000-00805f9b34fb', characteristic: '00002af1-0000-1000-8000-00805f9b34fb' },
  { service: '0000ff00-0000-1000-8000-00805f9b34fb', characteristic: '0000ff02-0000-1000-8000-00805f9b34fb' },
];

export async function printViaBluetooth(receiptData, onStatus) {
  if (!navigator.bluetooth) {
    throw new Error('Web Bluetooth API is not available. Please use Chrome or Edge browser, and make sure the site is served over HTTPS or localhost.');
  }

  onStatus?.('Scanning for Bluetooth devices...');
  const bytes = buildReceiptBytes(receiptData);

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: BLE_PROFILES.map(p => p.service),
  });

  onStatus?.(`Connecting to ${device.name || 'printer'}...`);
  const server = await device.gatt.connect();

  let characteristic = null;
  for (const profile of BLE_PROFILES) {
    try {
      const svc = await server.getPrimaryService(profile.service);
      characteristic = await svc.getCharacteristic(profile.characteristic);
      break;
    } catch {
      continue;
    }
  }

  if (!characteristic) {
    device.gatt.disconnect();
    throw new Error('Could not find a compatible ESC/POS print service on this device. Please verify it is a standard BLE ESC/POS printer.');
  }

  onStatus?.('Sending data to printer...');
  const CHUNK = 20;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    await characteristic.writeValue(bytes.slice(i, i + CHUNK));
  }

  device.gatt.disconnect();
  onStatus?.('Print complete!');
  return true;
}

// Send cash drawer open ESC/POS command via Bluetooth (ESC p 0 25 250)
export async function openCashDrawerViaBluetooth(onStatus) {
  if (!navigator.bluetooth) {
    throw new Error('Web Bluetooth not available.');
  }
  const drawerCmd = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);
  onStatus?.('Connecting to printer...');
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: BLE_PROFILES.map(p => p.service),
  });
  const server = await device.gatt.connect();
  let characteristic = null;
  for (const profile of BLE_PROFILES) {
    try {
      const svc = await server.getPrimaryService(profile.service);
      characteristic = await svc.getCharacteristic(profile.characteristic);
      break;
    } catch { continue; }
  }
  if (!characteristic) {
    device.gatt.disconnect();
    throw new Error('Could not find a compatible ESC/POS service.');
  }
  await characteristic.writeValue(drawerCmd);
  device.gatt.disconnect();
  onStatus?.('Cash drawer opened!');
  return true;
}

// A4 report print using browser print dialog
export function printA4Report(htmlContent, title = 'POS Report') {
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12pt; margin: 20mm; }
        h1 { font-size: 16pt; margin-bottom: 4px; }
        h2 { font-size: 13pt; margin-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #495057; color: white; padding: 6px 10px; text-align: left; }
        td { padding: 5px 10px; border-bottom: 1px solid #dee2e6; }
        .text-right { text-align: right; }
        .summary-box { display: inline-block; border: 1px solid #dee2e6; padding: 10px 20px; margin: 5px; min-width: 150px; }
        @media print { body { margin: 10mm; } }
      </style>
    </head>
    <body>${htmlContent}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}
