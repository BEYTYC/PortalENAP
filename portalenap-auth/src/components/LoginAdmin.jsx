/**
 * components/LoginAdmin.jsx
 *
 * Pantalla de login administrativo de PortalENAP: panel izquierdo de marca
 * institucional (navy/dorado) + panel derecho con el botón de inicio de
 * sesión de Microsoft. Conectado a services/authService.js (MSAL.js +
 * resolución de roles contra 'ENAP_Permisos_Usuarios').
 *
 * Uso:
 *   <LoginAdmin onAutorizado={(sesion) => ...} logoSrc="/logo-enap.png" />
 *
 * `sesion` = { perfil, roles } — ver services/authService.js.
 */

import { useState, useCallback } from 'react';
import { iniciarSesionYObtenerRoles, cerrarSesion } from '../services/authService';
import './LoginAdmin.css';

const LOGO_FALLBACK_INICIALES = 'EN';

function LogoMicrosoft() {
  return (
    <svg viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export default function LoginAdmin({ onAutorizado, logoSrc }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [logoFallo, setLogoFallo] = useState(!logoSrc);

  const manejarLogin = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const sesion = await iniciarSesionYObtenerRoles();
      onAutorizado(sesion);
    } catch (caught) {
      await cerrarSesion().catch(() => {});
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setCargando(false);
    }
  }, [onAutorizado]);

  return (
    <div className="login-admin">
      <div className="login-admin__brand">
        <div className="login-admin__brand-mark">
          {logoFallo ? (
            <div className="login-admin__brand-fallback">{LOGO_FALLBACK_INICIALES}</div>
          ) : (
            <img
              src={logoSrc}
              alt='Escudo Escuela Naval de Cadetes "Almirante Padilla"'
              onError={() => setLogoFallo(true)}
            />
          )}
          <span>ESCUELA NAVAL DE CADETES &ldquo;ALMIRANTE PADILLA&rdquo;</span>
        </div>

        <div className="login-admin__brand-heading">
          <p className="login-admin__eyebrow">
            Proyecto de Transformación Digital · Oficina de Estadística
          </p>
          <div className="login-admin__gold-rule" />
          <h1>Portal ENAP</h1>
          <p>
            Plataforma institucional de gestión académica, desarrollada en el marco del Proyecto
            de Transformación Digital de la Oficina de Estadística. Acceso restringido a personal
            autorizado.
          </p>
        </div>

        <div className="login-admin__brand-footer">
          <span className="login-admin__dot" />
          <span>Cartagena de Indias, Colombia</span>
        </div>
      </div>

      <div className="login-admin__form-panel">
        <div className="login-admin__form-card">
          <h2>Acceso administrativo</h2>
          <p className="login-admin__subtitle">
            Inicia sesión con tu cuenta institucional para continuar
          </p>

          {error && (
            <div className="login-admin__error" role="alert">
              <p>{error}</p>
            </div>
          )}

          <button
            type="button"
            className="login-admin__btn"
            onClick={manejarLogin}
            disabled={cargando}
          >
            <LogoMicrosoft />
            {cargando ? 'Verificando…' : 'Iniciar sesión con cuenta institucional'}
          </button>

          <p className="login-admin__footer">
            Solo personal con roles activos en el sistema podrá acceder al panel.
          </p>
        </div>
      </div>
    </div>
  );
}
