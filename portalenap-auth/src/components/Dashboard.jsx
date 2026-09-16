/**
 * components/Dashboard.jsx
 *
 * Primera pantalla que ve el usuario ya autenticado: muestra quién es
 * (nombre + correo, tomado del perfil de Graph) y qué rol(es) tiene, y
 * debajo el módulo de ejemplo "Solicitud de Grado" que cambia de
 * contenido según el rol — ver SolicitudGrado.jsx.
 */

import SolicitudGrado from './SolicitudGrado';
import './Dashboard.css';

export default function Dashboard({ sesion, onCerrarSesion }) {
  const { perfil, roles } = sesion;
  const nombre = perfil.displayName || perfil.mail || perfil.userPrincipalName;
  const correo = perfil.mail || perfil.userPrincipalName;

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__saludo">Hola, {nombre}</p>
          <p className="dashboard__correo">{correo}</p>
        </div>
        <div className="dashboard__header-derecha">
          <div className="dashboard__roles">
            {roles.map((rol) => (
              <span key={rol} className="dashboard__rol-chip">{rol}</span>
            ))}
          </div>
          <button type="button" className="dashboard__salir" onClick={onCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="dashboard__main">
        <SolicitudGrado roles={roles} />
      </main>
    </div>
  );
}
