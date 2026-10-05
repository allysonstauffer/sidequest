import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import type { User } from '@supabase/supabase-js'

export default function Onboarding({ user, onComplete }: { user: User, onComplete: () => void }) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState(user.user_metadata?.full_name || '')
  const [hobbies, setHobbies] = useState([{ hobby: '', experience_level: 'Beginner' }])
  const [submitting, setSubmitting] = useState(false)

  const handleHobbyChange = (index: number, field: string, value: string) => {
    const updated = [...hobbies]
    updated[index] = { ...updated[index], [field]: value }
    setHobbies(updated)
  }
  const addHobbyField = () => {
    setHobbies([...hobbies, { hobby: '', experience_level: 'Beginner' }])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const { error: profileError } = await supabase.from('profiles').insert({
      id: user.id,
      username: username,
      display_name: displayName,
    })

    if (profileError) {
      alert(profileError.message)
      setSubmitting(false)
      return
    }

    const hobbyRows = hobbies
      .filter((h) => h.hobby.trim() !== '')
      .map((h) => ({
        user_id: user.id,
        hobby: h.hobby.trim(),
        experience_level: h.experience_level,
      }))

    if (hobbyRows.length > 0) {
      const { error: hobbyError } = await supabase.from('user_hobbies').insert(hobbyRows)
      if (hobbyError) console.error("Error saving hobbies:", hobbyError.message)
    }

    setSubmitting(false)
    onComplete() 
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '400px', margin: '2rem auto', textAlign: 'left' }}>
      <h2>Complete Your Profile</h2>

      <div style={{ marginBottom: '1rem' }}>
        <label>Username</label><br/>
        <input 
          required 
          value={username} 
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          style={{ width: '100%' }} 
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Display Name</label><br/>
        <input 
          required 
          value={displayName} 
          onChange={(e) => setDisplayName(e.target.value)} 
          style={{ width: '100%' }} 
        />
      </div>

      <h3>Your Hobbies</h3>
      {hobbies.map((h, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            placeholder="e.g. Bouldering, Coding"
            value={h.hobby}
            onChange={(e) => handleHobbyChange(i, 'hobby', e.target.value)}
            style={{ flex: 1 }}
          />
          <select value={h.experience_level} onChange={(e) => handleHobbyChange(i, 'experience_level', e.target.value)}>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
            <option value="Expert">Expert</option>
          </select>
        </div>
      ))}

      <button type="button" onClick={addHobbyField} style={{ marginBottom: '1rem' }}>+ Add Hobby</button>
      <br />
      <button type="submit" disabled={submitting} style={{ width: '100%' }}>
        {submitting ? 'Saving...' : 'Finish Setup'}
      </button>
    </form>
  )
}