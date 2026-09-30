import { useState, type FormEvent } from 'react'


//add supabase at some point
function LoginPage() {
  const [signupNotice, setSignupNotice] = useState('')
  const [notice, setNotice] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
  }
  function passCheck(password: string, confirmPassword: string) {
    return password === confirmPassword;
  }

  function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const password = String(formData.get('password') ?? '')
    const confirmPassword = String(formData.get('confirmPassword') ?? '')

    setSignupNotice(
      passCheck(password, confirmPassword)? 'Passwords match.' : 'Passwords do not match.',
    )
  }

  return (
    <section className="site-page">
      <p className="site-eyebrow">Welcome!</p>
      <h1>Log in</h1>

      <form className="site-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="new-password" required />
        </label>
        <button type="submit" className="site-button site-button-primary">Continue</button>
        {notice && <p className="site-notice" role="status">{notice}</p>}
      </form>
      <p>Don&apos;t have an account? Sign Up Today!</p>
      <form className = "site-form" onSubmit={handleSignUp}>
         <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <label>
            Confirm Password
            <input name="confirmPassword" type="password" autoComplete="new-password" required />
        </label>

        <button type="submit" className="site-button site-button-primary">Continue</button>
        {signupNotice && <p className="site-notice" role="status">{signupNotice}</p>}
      </form>
    </section>
  )
}

export default LoginPage