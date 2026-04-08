import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("sw_token"));
  const [user, setUser] = useState(() => {
    const rawUser = localStorage.getItem("sw_user");
    return rawUser ? JSON.parse(rawUser) : null;
  });

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

  const value = useMemo(
    () => ({
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
      logout() {
        setToken(null);
        setUser(null);
      }
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
