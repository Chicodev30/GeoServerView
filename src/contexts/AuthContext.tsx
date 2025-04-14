import { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string;
  serverUrl: string;
  isLoading: boolean;
  login: (username: string, password: string, serverUrl: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  getAuthHeader: () => string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [authHeader, setAuthHeader] = useState('');

  const login = async (username: string, password: string, serverUrl: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${serverUrl}/rest/workspaces`,
        {
          headers: {
            'Authorization': `Basic ${btoa(`${username}:${password}`)}`
          }
        }
      );

      if (response.status === 401) {
        return { 
          success: false, 
          error: 'Credenciais inválidas. Verifique a URL fornecida, seu usuário e senha.' 
        };
      }

      if (!response.ok) {
        return { 
          success: false, 
          error: 'Servidor inacessível. Verifique a URL do servidor e sua conexão com a internet.' 
        };
      }

      const data = await response.json();
      if (!data.workspaces) {
        return { 
          success: false, 
          error: 'Resposta do servidor inválida. Verifique se o servidor é um GeoServer válido.' 
        };
      }

      setUsername(username);
      setServerUrl(serverUrl);
      setAuthHeader(btoa(`${username}:${password}`));
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: 'Erro de conexão. Verifique sua conexão com a internet e a URL do servidor.' 
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setServerUrl('');
    setAuthHeader('');
    // Clear search state from localStorage on logout
    localStorage.removeItem('searchState');
  };

  const getAuthHeader = () => `Basic ${authHeader}`;

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      username,
      serverUrl,
      isLoading,
      login,
      logout,
      getAuthHeader
    }}>
      {children}
    </AuthContext.Provider>
  );
};