import styles from './App.module.css'
import BackgroundLayout from './components/BackgroundLayout'
import Section from './components/Section'

function App() {
  return (
    <div className={styles.container}>
      <BackgroundLayout
        header={
          <div style={{ textAlign: "center", color: "#6E6B60", display: "flex", flexDirection: "column", paddingTop: 75, gap: "10px" }}>
            <h1>Sanam Louise Kavari & Owen Francis Searls</h1>
            <span style={{fontStyle: "italic", fontSize: "20px"}}>will be married</span>
            <h2>September 19, 2026, Hartland, Vermont</h2>
          </div>
        }
        footer={
          <div style={{ color: "#6E6B60", textAlign: "center", padding: "20px 20px 0 20px" }}>
            <p>© 2026 Sanam & Owen</p>
          </div>
        }
      >
        <Section id="faq" anchor="faq" minHeight="auto">
          <div style={{ padding: "50px 25px", color: "#6E6B60" }}>
            <h1 style={{ textAlign: "center" }}>FAQ</h1>
            <div style={{ maxWidth: "600px", margin: "0 auto" }}>
              <h2>When is the wedding?</h2>
              <p>September 19, 2026</p>

              <h2>Where is the wedding?</h2>
              <p>Hartland, Vermont</p>

              <h2>What should I wear?</h2>
              <p>More details coming soon.</p>

              <h2>Will there be accommodations nearby?</h2>
              <p>Yes, we will provide information about local accommodations.</p>
            </div>
          </div>
        </Section>
      </BackgroundLayout>
    </div>
  )
}

export default App
