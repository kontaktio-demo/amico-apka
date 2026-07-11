// Uruchamia aplikacje desktopowa.
//
// Niektore srodowiska (m.in. terminal w VS Code) ustawiaja ELECTRON_RUN_AS_NODE=1.
// Electron startuje wtedy jako zwykly Node i require('electron') zwraca sciezke
// zamiast API, przez co aplikacja nie wstaje. Czyscimy te zmienna przed startem.
const { spawn } = require('node:child_process')
const electron = require('electron') // pod Node zwraca sciezke do electron.exe

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const proces = spawn(electron, ['.', ...process.argv.slice(2)], { stdio: 'inherit', env })
proces.on('close', (kod) => process.exit(kod ?? 0))
