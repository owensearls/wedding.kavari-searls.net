import styles from './App.module.css'
import typography from './typography.module.css'
import BackgroundLayout from './components/BackgroundLayout'
import Section from './components/Section'

function App() {
  return (
    <div className={styles.container}>
      <BackgroundLayout
        header={
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", paddingTop: 75, gap: "10px" }}>
            <h1>Sanam Louise Kavari <span className={typography.italicConnector}>and</span> Owen Francis Searls</h1>
              <h1><span className={typography.italicConnector}>will be married on</span></h1>
            <h1>September 19, 2026 <span className={typography.italicConnector}>in</span> Hartland, Vermont</h1>
          </div>
        }
        footer={
          <div style={{ textAlign: "center", padding: "25px" }}>
            <h2>Web Development <span className={typography.italicConnector}>by</span> Owen Searls</h2>
            <h2>Artwork <span className={typography.italicConnector}>by</span> Elana Sanford</h2>
          </div>
        }
      >
        <Section id="rsvp" anchor="rsvp" minHeight="100dvh">
            <h1 style={{ textAlign: "center", padding: "25px" }}>RSVP</h1>
            <div style={{ maxWidth: "600px", margin: "0 auto" }}>
              <h2>Coming soon</h2>
          </div>
        </Section>
        <Section id="faq" anchor="faq" minHeight="100dvh">
            <h1 style={{ textAlign: "center", padding: "25px" }}>FAQ</h1>
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
        </Section>
      </BackgroundLayout>
    </div>
  )
}

export default App
