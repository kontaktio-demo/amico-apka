import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource-variable/inter-tight'
import '@fontsource-variable/space-grotesk'
// Fraunces = font naglowkow na dokumentach (faktura, wycena, KP...). Bez tego importu
// wszystkie tytuly dokumentow spadaly na systemowy serif (Times New Roman) na ekranie i w PDF.
import '@fontsource-variable/fraunces'
import './index.css'
import App from './App'
import { enableNativeFeel } from './lib/nativeFeel'

enableNativeFeel()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
