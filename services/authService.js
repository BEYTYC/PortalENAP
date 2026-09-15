import axios from 'axios';

/**
 * Servicio para verificar los permisos y roles del usuario autenticado
 * consultando la lista de SharePoint ENAP_Permisos_Usuarios.
 */
export async function verificarPermisosUsuario(accessToken) {
    try {
        if (!accessToken) {
            throw new Error('No se proporcionó un token de acceso válido.');
        }

        // 1. Obtener el correo del usuario autenticado mediante Microsoft Graph
        const graphResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        const userEmail = graphResponse.data.mail || graphResponse.data.userPrincipalName;

        // 2. Consultar la lista de SharePoint ENAP_Permisos_Usuarios 
        // para verificar si el usuario está Activo y qué rol o roles posee.
        const permisoSharePoint = await consultarPermisoEnSharePoint(accessToken, userEmail);

        if (!permisoSharePoint || permisoSharePoint.Estado !== 'Activo') {
            throw new Error('Acceso denegado o usuario inactivo en el sistema.');
        }

        return {
            email: userEmail,
            rol: permisoSharePoint.Rol,
            activo: true
        };

    } catch (error) {
        console.error('Error de autenticación y validación de permisos:', error);
        throw error;
    }
}

async function consultarPermisoEnSharePoint(accessToken, email) {
    // Aquí se realiza la petición a la lista de SharePoint utilizando el token
    // para buscar la coincidencia con el correo (Title) y verificar el campo Estado y Rol.
    
    // Ejemplo de estructura de retorno basada en tu lista ENAP_Permisos_Usuarios:
    return {
        Title: email,
        Rol: "ADMIN", // O el rol que tenga asignado en la fila de SharePoint
        Estado: "Activo"
    };
}
