import { EdgeToEdgeLayout } from '../components/EdgeToEdgeLayout'
import { PageLayout } from '../components/ui/PageLayout'
import styles from './index.module.css'
import { RsvpFull } from './RsvpFull'

export default function RsvpPage() {
  return (
    <PageLayout title="RSVP · Kavari-Searls Wedding">
      <EdgeToEdgeLayout>
        <div className={styles.formContent}>
          <RsvpFull />
        </div>
      </EdgeToEdgeLayout>
    </PageLayout>
  )
}
