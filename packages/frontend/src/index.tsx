import { BackgroundLayout } from './components/BackgroundLayout'
import { RsvpLookup } from './components/RsvpLookup'
import { Section } from './components/Section'
import { PageLayout } from './components/ui/PageLayout'
import styles from './index.module.css'
import typography from './typography.module.css'

export default function Home() {
  return (
    <PageLayout title="Kavari-Searls Wedding">
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
        <Section id="rsvp" anchor="rsvp" minHeight="100dvh">
          <h1 style={{ textAlign: 'center', padding: '25px' }}>RSVP</h1>
          <RsvpLookup />
        </Section>
        <Section id="faq" anchor="faq" minHeight="125dvh">
          <h1 style={{ textAlign: 'center', padding: '25px' }}>FAQ</h1>
          <div className={styles.faqContent}>
            <h2>When is the wedding?</h2>
            <p>
              The ceremony will be at 2:30PM on September 19, 2026 followed by a
              reception and dinner.
            </p>

            <h2>Where is the wedding?</h2>
            <p>
              We will be married at North Chapel in Woodstock, VT. The address
              is 7 Church St, Woodstock VT 05091. The reception will be at the
              Searls' family cottage in West Windsor, VT, an approximately 15
              minute drive from the ceremony.{' '}
            </p>

            <h2>What should I wear?</h2>
            <p>
              The ceremony and reception will be semi-formal. However, the
              reception will be primarily outdoors, so we encourage everyone to
              dress comfortably for a fall evening in Vermont, with typical lows
              in the mid-forties to fifies, and for walking on grass.{' '}
            </p>

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
    </PageLayout>
  )
}
