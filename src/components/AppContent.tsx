import { useAuth } from '../contexts/AuthContext';
import { LoginForm } from './Auth/LoginForm';
import { MapComponent } from './Map/MapComponent';

export const AppContent = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <div className="h-screen w-full">
      <MapComponent />
    </div>
  );
};