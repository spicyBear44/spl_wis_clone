import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("sw_token"));
  const [user, setUser] = useState(() => {
    const rawUser = localStorage.getItem("sw_user");
    return rawUser ? JSON.parse(rawUser) : null;
  });
  const [authChecking, setAuthChecking] = useState(Boolean(localStorage.getItem("sw_token")));

  useEffect(() => {
    if (token) {
      localStorage.setItem("sw_token", token);
    } else {
      localStorage.removeItem("sw_token");
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("sw_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("sw_user");
    }
  }, [user]);

  async function verifySession() {
    const storedToken = localStorage.getItem("sw_token");

    if (!storedToken) {
      setToken(null);
      setUser(null);
      setAuthChecking(false);
      return null;
    }

    setAuthChecking(true);
    try {
      const response = await authApi.me();
      setToken(storedToken);
      setUser(response.user);
      return response.user;
    } catch (error) {
      setToken(null);
      setUser(null);
      return null;
    } finally {
      setAuthChecking(false);
    }
  }

  useEffect(() => {
    verifySession();

    function handlePageShow(event) {
      if (event.persisted || localStorage.getItem("sw_token")) {
        verifySession();
      }
    }

    function handleStorage(event) {
      if (event.key === "sw_token" || event.key === "sw_user") {
        verifySession();
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const value = useMemo(
    () => ({
      authChecking,
      token,
      user,
      async login(credentials) {
        const response = await authApi.login(credentials);
        setToken(response.token);
        setUser(response.user);
        return response;
      },
      async register(payload) {
        const response = await authApi.register(payload);
        setToken(response.token);
        setUser(response.user);
        return response;
      },
      updateUser(partialUser) {
        setUser((currentUser) => (currentUser ? { ...currentUser, ...partialUser } : currentUser));
      },
      logout() {
        setToken(null);
        setUser(null);
        setAuthChecking(false);
      }
    }),
    [authChecking, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
