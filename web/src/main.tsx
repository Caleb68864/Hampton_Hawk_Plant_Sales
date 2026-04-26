import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/fraunces/index.css'
import '@fontsource/manrope/index.css'
import './index.css'
import './styles/joy.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
