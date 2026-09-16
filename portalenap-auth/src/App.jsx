/**
 * App.jsx
 *
 * Punto de entrada visual de PortalENAP: mientras no haya una sesión
 * autenticada, muestra LoginAdmin; en cuanto el login resuelve el perfil
 * + roles, muestra Dashboard. Al recargar la página, intenta retomar la
 * sesión en silencio (sin volver a pedir el popup) con retomarSesion().
 */

import { useEffect, useState } from 'react';
import LoginAdmin from './components/LoginAdmin';
import Dashboard from './components/Dashboard';
import { retomarSesion, cerrarSesion } from './services/authService';

export default function App() {
  const [sesion, setSesion] = useState(null);
  const [verificandoSesionPrevia, setVerificandoSesionPrevia] = useState(true);

  useEffect(() => {
    retomarSesion()
      .then((sesionPrevia) => setSesion(sesionPrevia))
      .catch(() => setSesion(null))
      .finally(() => setVerificandoSesionPrevia(false));
  }, []);

  if (verificandoSesionPrevia) {
    return null; // evita un parpadeo del login mientras se verifica la sesión
  }

  if (!sesion) {
    return <LoginAdmin onAutorizado={setSesion} logoSrc="/logo-enap.png" />;
  }

  return (
    <Dashboard
      sesion={sesion}
      onCerrarSesion={async () => {
        await cerrarSesion();
        setSesion(null);
      }}
    />
  );
}
