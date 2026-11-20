import { BackgroundLayout } from './components/BackgroundLayout'
import { Section } from './components/Section'
import { PageLayout } from './components/ui/PageLayout'
import styles from './index.module.css'
import typography from './typography.module.css'

export default function Home() {
  return (
    <PageLayout title="Kavari-Searls Wedding">
      <BackgroundLayout
        header={
          <div className={styles.homeHeader}>
            <h1>
              Sanam Louise Kavari{' '}
              <span className={typography.italicConnector}>and</span> Owen
              Francis Searls
            </h1>
            <h1>
              <span className={typography.italicConnector}>
                were married on
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
          <div
            className={styles.credits}
            style={{ textAlign: 'center', padding: '25px' }}
          >
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
        <Section id="thanks" anchor="thanks" minHeight="100dvh" scrollable>
          <h1 style={{ textAlign: 'center', padding: '25px' }}>
            Thank You <span className={typography.italicConnector}>for</span>{' '}
            Coming
          </h1>
          <div className={styles.thanksContent}>
            <p>
              Instead of gifts, we ask that guests{' '}
              <a href="https://secure.phillypaws.org/fundraiser/7454888">
                make a donation
              </a>{' '}
              to the Philadelphia Animal Welfare Society (PAWS), the shelter
              where Sanam and Owen adopted their beloved cat Ruairí.
            </p>
          </div>
        </Section>
      </BackgroundLayout>
    </PageLayout>
  )
}
