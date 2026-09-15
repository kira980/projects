import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Global spinner keyframe (injected once — avoids needing a CSS bundler)
const style = document.createElement('style')
style.textContent = `
  @keyframes bf-spin {
    to { transform: rotate(360deg); }
  }
  *, *::before, *::after { box-sizing: border-box; }
  body, html { margin: 0; padding: 0; }
`
document.head.appendChild(style)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
