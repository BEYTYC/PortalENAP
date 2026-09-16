/**
 * components/SolicitudGrado.jsx
 *
 * EJEMPLO de cómo un mismo módulo ("Solicitud de Grado") muestra una
 * pantalla distinta según el rol de la persona que inició sesión —
 * exactamente el caso que pediste: al Secretario Académico le aparece
 * "Configurar Ceremonias", al Decano de Facultad le aparece "Aprobación
 * de tu grupo".
 *
 * Este componente NO decide todavía nada del lado servidor: solo cambia
 * lo que se MUESTRA según el rol. La validación real de "quién puede
 * aprobar/configurar qué" debe reforzarse más adelante también en el
 * backend — ver la nota de seguridad al final de este archivo.
 *
 * roles: arreglo de strings en mayúsculas, tal como los devuelve
 * services/authService.js (por ejemplo ['SECRETARIO_ACADEMICO']).
 */

function VistaSecretarioAcademico() {
  return (
    <div className="modulo-card">
      <h3>Configurar ceremonias</h3>
      <p>
        Como Secretario Académico, aquí defines las ceremonias de grado disponibles: fecha,
        lugar y programas habilitados para inscribirse en cada una.
      </p>
      <ul className="modulo-lista-ejemplo">
        <li>Ceremonia — Noviembre 2026 (Auditorio Principal)</li>
        <li>Ceremonia — Marzo 2027 (por programar)</li>
      </ul>
      <button type="button" className="modulo-btn">+ Nueva ceremonia</button>
    </div>
  );
}

function VistaDecanoFacultad() {
  return (
    <div className="modulo-card">
      <h3>Aprobación de tu grupo</h3>
      <p>
        Como Decano de Facultad, aquí revisas y apruebas las solicitudes de grado radicadas por
        los estudiantes de tu facultad, ya validadas previamente por el Jefe de Programa.
      </p>
      <ul className="modulo-lista-ejemplo">
        <li>12 solicitudes pendientes de tu aprobación</li>
        <li>3 solicitudes ya aprobadas este mes</li>
      </ul>
      <button type="button" className="modulo-btn">Revisar solicitudes de mi grupo</button>
    </div>
  );
}

function VistaSinAsignar({ roles }) {
  return (
    <div className="modulo-card modulo-card--vacio">
      <h3>Sin vista asignada</h3>
      <p>
        Tu(s) rol(es) actuales ({roles.join(', ')}) todavía no tienen una pantalla configurada
        para el módulo de Solicitud de Grado.
      </p>
    </div>
  );
}

export default function SolicitudGrado({ roles }) {
  return (
    <section>
      <h2 className="modulo-titulo">Solicitud de Grado</h2>

      {roles.includes('SECRETARIO_ACADEMICO') && <VistaSecretarioAcademico />}
      {roles.includes('DECANO_FACULTAD') && <VistaDecanoFacultad />}
      {!roles.includes('SECRETARIO_ACADEMICO') && !roles.includes('DECANO_FACULTAD') && (
        <VistaSinAsignar roles={roles} />
      )}
    </section>
  );
}

/**
 * NOTA DE SEGURIDAD: por ahora esto solo controla qué se MUESTRA en el
 * navegador. Si más adelante estas pantallas llaman una API para
 * aprobar/configurar algo de verdad, esa API también debe verificar el
 * rol del usuario del lado del servidor — nunca confiar en que "como no
 * se ve el botón, no lo puede hacer". Ocultar un botón es una mejora de
 * experiencia, no una barrera de seguridad.
 */
