import styles from './App.module.css'
import typography from './typography.module.css'
import BackgroundLayout from './components/BackgroundLayout'
import Section from './components/Section'
import RsvpLookup from './routes/RsvpLookup'

function App() {
  return (
    <div className={styles.container}>
      <BackgroundLayout
        header={
          <div
            style={{
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              paddingTop: 75,
              gap: '10px',
            }}
          >
            <h1>
              Sanam Louise Kavari{' '}
              <span className={typography.italicConnector}>and</span> Owen
              Francis Searls
            </h1>
            <h1>
              <span className={typography.italicConnector}>
                will be married on
              </span>
            </h1>
            <h1>
              September 19, 2026{' '}
              <span className={typography.italicConnector}>in</span> Hartland,
              Vermont
            </h1>
          </div>
        }
        footer={
          <div style={{ textAlign: 'center', padding: '25px' }}>
            <h2>
              Web Development{' '}
              <span className={typography.italicConnector}>by</span> Owen Searls
            </h2>
            <h2>
              Artwork <span className={typography.italicConnector}>by</span>{' '}
              Elana Sanford
            </h2>
          </div>
        }
      >
        <Section id="rsvp" anchor="rsvp" minHeight="100dvh">
          <h1 style={{ textAlign: 'center', padding: '25px' }}>RSVP</h1>
          <RsvpLookup />
        </Section>
        <Section id="faq" anchor="faq" minHeight="100dvh">
          <h1 style={{ textAlign: 'center', padding: '25px' }}>FAQ</h1>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2>When is the wedding?</h2>
            <p>September 19, 2026</p>

            <h2>Where is the wedding?</h2>
            <p>Hartland, Vermont</p>

            <h2>What should I wear?</h2>
            <p>More details coming soon.</p>

            <h2>Will there be accommodations nearby?</h2>
            <p>
              We have organized a block of rooms for guests at The Shire in
              Woodstock, VT with a discount code. Reserve rooms{' '}
              <a href="https://app.mews.com/distributor/42e94bfb-cc36-4089-831f-b0de011d3d8e?mewsVoucherCode=Kavari">
                here
              </a>{' '}
              with promotion code "Kavari". Please reserve rooms prior to July
              18, 2026 to use the discount code.
            </p>
          </div>
        </Section>
      </BackgroundLayout>
    </div>
  )
}

export default App
