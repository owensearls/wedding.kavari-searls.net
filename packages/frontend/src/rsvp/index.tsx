import { Backdrop } from '../components/Backdrop'
import { PageLayout } from '../components/ui/PageLayout'
import { RsvpFull } from './RsvpFull'

export default function RsvpPage() {
  return (
    <PageLayout title="RSVP · Kavari-Searls Wedding">
      <Backdrop />
      <div className="page-content">
        <RsvpFull />
      </div>
    </PageLayout>
  )
}
