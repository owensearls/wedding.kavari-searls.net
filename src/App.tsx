import styles from './App.module.css'
import BackgroundLayout from './components/BackgroundLayout'

function App() {
  return (
    <div className={styles.container}>
      <BackgroundLayout>
        <div id="faq" style={{ minHeight: "600px", padding: "50px 25px", color: "#6E6B60" }}>
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
        <div id="main" style={{ textAlign: "center", color: "#6E6B60", display: "flex", flexDirection: "column", paddingTop: 25, minHeight: "100vh" }}>
          <a
            href="#faq"
            onClick={(e) => {
              e.preventDefault()
              const faqElement = document.getElementById('faq')
              const container = document.querySelector(`.${styles.container}`)?.firstElementChild as HTMLElement
              if (faqElement && container) {
                container.scrollTo({
                  top: 0,
                  behavior: 'smooth'
                })
              }
            }}
            style={{
              color: "#6E6B60",
              textDecoration: "none",
              fontSize: "18px",
              marginBottom: "20px",
              cursor: "pointer",
              fontStyle: "italic"
            }}
          >
            View FAQ
          </a>
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
