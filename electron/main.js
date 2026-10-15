/* Freeduck-Translator — ventana de escritorio (Electron).
   Carga la misma web local (index.html) que la PWA: mismos motores, mismos
   modelos. La traducción ES↔EN, la voz y el dictado funcionan sin conexión
   una vez pulsado «⬇ Descarga para usar sin conexión» dentro de la app.
   El resto de idiomas y la primera preparación sí necesitan internet. */
'use strict';

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 360,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: '#0c0d12',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  // Los enlaces externos (p. ej. MyMemory en el pie) se abren en el
  // navegador del sistema, no dentro de la app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
