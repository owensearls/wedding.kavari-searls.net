import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { rsvpLookup } from '../lib/api'
import type { LookupMatch } from '@shared/schemas/rsvp'
import styles from './RsvpLookup.module.css'

function RsvpLookup() {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<LookupMatch[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setMatches(null)
    try {
      const res = await rsvpLookup(query.trim())
      if (res.matches.length === 0) {
        setError(
          "We couldn't find your invitation. Try a different spelling, or reach out to Sanam or Owen.",
        )
      } else {
        setMatches(res.matches)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>
        Enter your name or email to find your invitation.
      </p>
      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.row}>
          <input
            type="text"
            className={styles.input}
            placeholder="Your name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="name"
          />
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Looking…' : 'Find me'}
          </button>
        </div>
        {error && <div className={styles.error}>{error}</div>}
      </form>

      {matches && matches.length > 0 && (
        <div className={styles.matches}>
          {matches.length > 1 && (
            <p className={styles.intro} style={{ marginTop: 8, marginBottom: 0 }}>
              We found a few possibilities — pick yours:
            </p>
          )}
          {matches.map((m) => (
            <Link
              key={m.partyLeaderId}
              to={`/rsvp/${m.inviteCode}`}
              className={styles.match}
            >
              <div className={styles.matchLabel}>{m.label}</div>
              <div className={styles.matchNames}>{m.guestNames.join(', ')}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default RsvpLookup
