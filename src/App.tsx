import styles from './App.module.css'
import BackgroundLayout from './components/BackgroundLayout'

function App() {
  return (
    <div className={styles.container}>
      <BackgroundLayout>
        <div style={{ textAlign: "center", color: "#6E6B60", display: "flex", flexDirection: "column", paddingTop: 25 }}>
          <h1>Sanam Louise Kavari & Owen Francis Searls</h1>
          <span style={{fontStyle: "italic", fontSize: "20px"}}>will be married</span>
          <h2>September 19, 2026, Hartland, Vermont</h2>
          <h2></h2>
        </div>
      </BackgroundLayout>
    </div>
  )
}

export default App
