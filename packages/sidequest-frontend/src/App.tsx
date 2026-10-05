import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Onboarding from './components/Onboarding'
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import type { Session } from '@supabase/supabase-js'
import './App.css'

export default function App() {
  // State management
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasProfile, setHasProfile] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Database check
  async function checkProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (data) setHasProfile(true)
    else setHasProfile(false)
    
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) checkProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        checkProfile(session.user.id)
      } else {
        setHasProfile(false)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // auth handlers
  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
    if (error) console.error("Error logging in with Google:", error.message)
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setAuthError(error.message)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setAuthError(error.message)
    }
    
    setAuthLoading(false)
  }

  if (loading) return <div>Loading...</div>

  // Not logged in -> landing page with auth
  if (!session) {
    return (
      <section id="center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="Hero" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        
        <div>
          <h1>Welcome to SideQuest</h1>
          <p>Sign in to start exploring hobbies and communities.</p>
        </div>

        <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '300px' }}>
          {authError && <div style={{ color: 'red', fontSize: '0.9rem' }}>{authError}</div>}
          
          <input 
            type="email" 
            placeholder="Email address" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            style={{ padding: '0.5rem' }}
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            style={{ padding: '0.5rem' }}
          />
          
          <button type="submit" disabled={authLoading}>
            {authLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In with Email')}
          </button>
        </form>

        <p style={{ fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </p>

        <hr style={{ width: '100%', maxWidth: '300px', opacity: 0.2 }} />

        <button type="button" className="counter" onClick={signInWithGoogle} style={{ width: '100%', maxWidth: '300px' }}>
          Sign in with Google
        </button>
      </section>
    )
  }

  // Logged in but missing data -> config
  if (!hasProfile) {
    return <Onboarding user={session.user} onComplete={() => setHasProfile(true)} />
  }

  // alr has profile -> main
  return (
    <div>
      <h1>Welcome back to SideQuest!</h1>
      <button onClick={() => supabase.auth.signOut()}>Sign Out</button>
    </div>
  )
}