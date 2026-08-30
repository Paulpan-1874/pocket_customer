import { createContext, useState, useCallback } from 'react'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('pb_auth_token') || '')
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('pb_current_user')
    return saved ? JSON.parse(saved) : null
  })
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('pb_auth_token'))
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const handleLogin = useCallback(async () => {
    if (!loginForm.email || !loginForm.password) {
      setLoginError('请输入邮箱和密码')
      return
    }

    setLoginLoading(true)
    setLoginError('')

    try {
      const response = await fetch('/api/collections/users/auth-with-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          identity: loginForm.email,
          password: loginForm.password
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: '登录失败' }))
        throw new Error(errorData.message || '登录失败')
      }

      const data = await response.json()
      setAuthToken(data.token)
      localStorage.setItem('pb_auth_token', data.token)
      localStorage.setItem('pb_current_user', JSON.stringify(data.record))
      setCurrentUser(data.record)
      setIsLoggedIn(true)
      setLoginForm({ email: '', password: '' })
    } catch (err) {
      setLoginError(err.message)
    } finally {
      setLoginLoading(false)
    }
  }, [loginForm.email, loginForm.password])

  const handleLogout = useCallback(() => {
    setIsLoggedIn(false)
    setCurrentUser(null)
    setAuthToken('')
    localStorage.removeItem('pb_auth_token')
    localStorage.removeItem('pb_current_user')
  }, [])

  const value = {
    authToken,
    currentUser,
    isLoggedIn,
    loginForm,
    loginError,
    loginLoading,
    setLoginForm,
    handleLogin,
    handleLogout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
