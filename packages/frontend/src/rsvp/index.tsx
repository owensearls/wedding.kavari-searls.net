import { PageLayout } from '../components/ui/PageLayout'
import { RsvpFull } from './RsvpFull'

export default function RsvpPage() {
  return (
    <PageLayout title="RSVP · Kavari-Searls Wedding">
      <div className="page-background" aria-hidden="true" />
      <div className="page-content">
        <RsvpFull />
      </div>
    </PageLayout>
  )
}
