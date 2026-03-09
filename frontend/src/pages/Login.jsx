import React, { useState } from 'react'
import loginBackground from '../assets/login.png'

function Login({
  form,
  error,
  showPassword,
  onChange,
  onSubmit,
  onTogglePassword,
  forgotUsername,
  forgotError,
  forgotSuccess,
  isSendingReset,
  onForgotUsernameChange,
  onForgotSubmit,
  onForgotClose,
}) {
  const [isForgotOpen, setIsForgotOpen] = useState(false)

  const closeForgotModal = () => {
    setIsForgotOpen(false)
    onForgotClose?.()
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');

        /* Reset default body margins */
        body {
          margin: 0;
          padding: 0;
        }
      `}</style>

      <style jsx>{`
        .page {
          display: flex;
          min-height: 100vh;
          margin: 0;
          font-family: 'Poppins', 'Segoe UI', sans-serif;
        }

        .hero {
          flex: 1;
          background-image: url(${loginBackground});
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          min-width: 50%;
          position: relative;
          background-color: #0f87b0;
        }

        .hero::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.2), transparent 40%),
            linear-gradient(135deg, rgba(7, 99, 132, 0.25), rgba(0, 165, 196, 0.1));
          mix-blend-mode: screen;
        }

        .form-area {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: linear-gradient(180deg, #f7fbfd 0%, #eff6fa 100%);
          position: relative;
          overflow: hidden;
        }

        .form-area::before,
        .form-area::after {
          content: '';
          position: absolute;
          border-radius: 50%;
          display: none;
        }

        .form-area::before {
          width: 220px;
          height: 220px;
          top: -40px;
          right: -70px;
        }

        .form-area::after {
          width: 320px;
          height: 320px;
          bottom: -140px;
          left: -120px;
        }

        .form-stack {
          width: 100%;
          max-width: 400px;
          position: relative;
        }

        .form-header-card {
          background: #0478A5;
          color: #fff;
          padding: 0.6rem 2.5rem 1.3rem;
          text-align: left;
          border-radius: 24px;
          box-shadow: 0 18px 40px rgba(10, 32, 44, 0.12);
          min-height: 170px;
          width: 100%;
        }

        .form-header-card h2 {
          font-size: 1.7rem;
          margin: 0;
          font-weight: 700;
          letter-spacing: 0.2px;
        }

        .form-card {
          background: #fff;
          border-radius: 24px;
          box-shadow: 0 18px 40px rgba(10, 32, 44, 0.12);
          overflow: hidden;
          margin-top: -112px;
          position: relative;
          z-index: 1;
          width: 100%;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 2.2rem 2.5rem 2.6rem;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .field-label {
          font-size: 1rem;
          font-weight: 600;
          color: #0b7aa6;
        }

        input[type="text"],
        input[type="password"] {
          padding: 0.6rem 0.2rem 0.7rem;
          border: none;
          border-bottom: 2px solid #cfd8de;
          border-radius: 0;
          font-size: 0.98rem;
          outline: none;
          transition: border-color 0.3s;
          background: transparent;
        }

        input[type="text"]:focus,
        input[type="password"]:focus {
          border-color: #0b7aa6;
        }

        .field.has-error input {
          border-color: #dc3545;
        }

        .password-field {
          position: relative;
        }

        .password-field input {
          padding-right: 3rem;
        }

        .eye-toggle {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #8a98a6;
          padding: 0;
        }

        .eye-toggle:hover {
          color: #0b7aa6;
        }

        .eye-icon {
          width: 20px;
          height: 20px;
        }

        .error {
          color: #dc3545;
          font-size: 0.85rem;
          margin: -0.5rem 0 0;
        }

        .submit {
          background-color: #0b7aa6;
          color: white;
          border: none;
          border-radius: 12px;
          padding: 0.8rem 1rem;
          font-size: 0.98rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.3s;
          margin-top: 0.4rem;
          width: 70%;
          align-self: center;
        }

        .forgot-password-btn {
          align-self: flex-end;
          background: none;
          border: none;
          color: #0b7aa6;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          margin-top: -0.5rem;
        }

        .forgot-password-btn:hover {
          text-decoration: underline;
        }

        .forgot-modal {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: grid;
          place-items: center;
        }

        .forgot-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
        }

        .forgot-card {
          position: relative;
          background: #fff;
          border-radius: 16px;
          padding: 24px 22px;
          width: min(420px, calc(100vw - 32px));
          box-shadow: 0 18px 40px rgba(10, 32, 44, 0.2);
          z-index: 1;
        }

        .forgot-card h3 {
          margin: 0 0 10px;
          font-size: 1.2rem;
          color: #12354b;
        }

        .forgot-card p {
          margin: 0 0 16px;
          color: #2d4a5d;
          font-size: 0.95rem;
          line-height: 1.4;
        }

        .forgot-card input[type="text"] {
          width: 100%;
          padding: 0.7rem 0.8rem;
          border: 1px solid #c6d2dc;
          border-radius: 10px;
          font-size: 0.95rem;
          margin: 0 0 12px;
          box-sizing: border-box;
          outline: none;
        }

        .forgot-card input[type="text"]:focus {
          border-color: #0b7aa6;
        }

        .forgot-card .forgot-error {
          color: #dc3545;
          font-size: 0.88rem;
          margin: 0 0 10px;
        }

        .forgot-card .forgot-success {
          color: #0b7a32;
          font-size: 0.88rem;
          margin: 0 0 10px;
        }

        .forgot-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .forgot-card button {
          border: none;
          border-radius: 10px;
          padding: 0.6rem 1.1rem;
          font-size: 0.92rem;
          font-weight: 600;
          background: #0b7aa6;
          color: #fff;
          cursor: pointer;
        }

        .submit:hover {
          background-color: #09688e;
        }

        .submit:active {
          transform: translateY(1px);
        }

        @media (max-width: 768px) {
          .page {
            flex-direction: column;
          }

          .hero {
            height: 40vh;
            min-width: 100%;
          }

          .form-area {
            padding: 1.5rem;
          }

          .form-stack {
            margin: 0 12px;
          }
          
          .form-header-card {
            border-radius: 24px;
          }
          
          .login-form {
            padding: 2rem 2.2;
          }
        }
      `}</style>

      <div className="page">
        <section className="hero" />
        
        <section className="form-area">
          <div className="form-stack">
            <header className="form-header-card">
              <h2>Log In</h2>
            </header>
            <div className="form-card">
              <form className="login-form" onSubmit={onSubmit}>
                <label className={`field ${error ? 'has-error' : ''}`}>
                  <span className="field-label">Username:</span>
                  <input
                    type="text"
                    placeholder="username"
                    name="username"
                    value={form.username}
                    onChange={onChange}
                    autoComplete="username"
                  />
                </label>
                <label className={`field ${error ? 'has-error' : ''}`}>
                  <span className="field-label">Password:</span>
                  <div className="password-field">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="********"
                      name="password"
                      value={form.password}
                      onChange={onChange}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="eye-toggle"
                      onClick={onTogglePassword}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <svg
                        className="eye-icon"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                        {!showPassword ? (
                          <line
                            x1="4"
                            y1="4"
                            x2="20"
                            y2="20"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        ) : null}
                      </svg>
                    </button>
                  </div>
                </label>
                {error ? <p className="error">{error}</p> : null}
                <button type="button" className="forgot-password-btn" onClick={() => setIsForgotOpen(true)}>
                  Forgot password?
                </button>
                <button type="submit" className="submit">Log In</button>
              </form>
            </div>
          </div>
        </section>
      </div>
      {isForgotOpen ? (
        <div className="forgot-modal" role="dialog" aria-modal="true" aria-labelledby="forgot-password-title">
          <div className="forgot-backdrop" onClick={closeForgotModal} />
          <div className="forgot-card">
            <h3 id="forgot-password-title">Password Assistance</h3>
            <p>Enter your username. We will send a password reset email to your account.</p>
            <form onSubmit={onForgotSubmit}>
              <input
                type="text"
                placeholder="Username"
                value={forgotUsername}
                onChange={onForgotUsernameChange}
                autoComplete="username"
              />
              {forgotError ? <p className="forgot-error">{forgotError}</p> : null}
              {forgotSuccess ? <p className="forgot-success">{forgotSuccess}</p> : null}
              <div className="forgot-actions">
                <button type="button" onClick={closeForgotModal}>Close</button>
                <button type="submit" disabled={isSendingReset}>
                  {isSendingReset ? 'Sending...' : 'Send reset email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default Login
