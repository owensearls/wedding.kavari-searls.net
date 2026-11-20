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
          <h1 style={{ textAlign: 'center', padding: '25px' }}>Thank You</h1>
          <div className={styles.thanksContent}>
            <p>
              Thank you to everyone who came to celebrate with us. Sharing the
              day with our family and friends meant the world to us, and we are
              so grateful for your love and support.
            </p>
            <p>
              Instead of gifts, we ask that you consider making a donation to
              the Philadelphia Animal Welfare Society (PAWS), the shelter where
              we adopted our beloved cat Ruairí.
            </p>
            <p>
              <a
                className={styles.donateLink}
                href="https://secure.phillypaws.org/fundraiser/7454888"
              >
                Donate to PAWS
              </a>
            </p>
            <p className={styles.signature}>
              <span className={typography.italicConnector}>With love,</span>
              <br />
              Sanam <span className={typography.italicConnector}>and</span> Owen
            </p>
          </div>
        </Section>
      </BackgroundLayout>
    </PageLayout>
  )
}
