import './App.module.css'
import styles from './App.module.css'

function App() {
  return (
    <div className={styles.background}>
        <div style={{ textAlign: "center", color: "#6E6B60", display: "flex", flexDirection: "column" }}>
            <h2>Sanam Louise Kavari</h2>
            <span>and</span>
            <h2>Owen Francis Searls</h2>
            <span>will be married</span>
        </div>
        <img src="/mountains.png" style={{width: "100%", maxWidth: "100%", position: "fixed", bottom: 0, maxHeight: "100vh", objectFit: "cover"}}></img>
    </div>
  )
}

export default App
