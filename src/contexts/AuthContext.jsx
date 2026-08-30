import { createContext, useState, useEffect, useCallback, useRef } from 'react'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('pb_auth_token') || '')
  const [currentUser, setCurrentUser] = useState(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const tokenVersionRef = useRef(0)

  useEffect(() => {
    if (authToken) {
      fetchUserInfo()
    } else {
      setIsLoggedIn(false)
      setCurrentUser(null)
    }
  }, [authToken])

  async function fetchUserInfo() {
    const currentVersion = tokenVersionRef.current
    try {
      const response = await fetch('/api/collections/users/auth-refresh', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })
      if (!response.ok) {
        throw new Error('Token invalid')
      }
      const data = await response.json()
      // 如果在请求期间 token 版本已变化（切换了账号），丢弃本次结果
      if (tokenVersionRef.current !== currentVersion) return
      setCurrentUser(data.record)
      setIsLoggedIn(true)
    } catch (err) {
      if (tokenVersionRef.current !== currentVersion) return
      console.log('获取用户信息失败:', err)
      setIsLoggedIn(false)
      setCurrentUser(null)
      localStorage.removeItem('pb_auth_token')
      setAuthToken('')
    }
  }

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
      tokenVersionRef.current++
      setAuthToken(data.token)
      localStorage.setItem('pb_auth_token', data.token)
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
    tokenVersionRef.current++
    setIsLoggedIn(false)
    setCurrentUser(null)
    setAuthToken('')
    localStorage.removeItem('pb_auth_token')
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
