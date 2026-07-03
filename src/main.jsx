import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import App from './App.jsx'

if (typeof window !== 'undefined') {
  const loadIcons = () => import('bootstrap-icons/font/bootstrap-icons.css');
  if (window.requestIdleCallback) {
    window.requestIdleCallback(() => loadIcons());
  } else {
    setTimeout(loadIcons, 200);
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
