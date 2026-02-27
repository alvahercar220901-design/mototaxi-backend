/**
 * Middleware de Autorización por Roles
 * 
 * Este middleware verifica que el usuario autenticado tenga uno de los roles permitidos
 * 
 * Uso: router.post("/ruta", authMiddleware, roleMiddleware(["conductor"]), controller.function)
 * 
 * @param {Array<string>} rolesPermitidos - Array de roles que tienen acceso a la ruta
 * @returns {Function} Middleware de Express
 */

/**
 * Crea un middleware que verifica si el usuario tiene uno de los roles permitidos
 * 
 * @param {Array<string>} rolesPermitidos - Roles que tienen acceso (ej: ["conductor", "pasajero"])
 * @returns {Function} Middleware de Express
 */
const roleMiddleware = (rolesPermitidos) => {
  return (req, res, next) => {
    try {
      // Verificar que req.user existe (debe ser inyectado por authMiddleware primero)
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado. Usa authMiddleware antes de roleMiddleware"
        });
      }

      // Obtener los roles del usuario autenticado
      const userRoles = req.user.roles || [];

      // Verificar que el usuario tenga al menos uno de los roles permitidos
      const tieneRolPermitido = rolesPermitidos.some(rol => userRoles.includes(rol));

      if (!tieneRolPermitido) {
        return res.status(403).json({
          success: false,
          message: `Acceso denegado. Se requiere uno de estos roles: ${rolesPermitidos.join(", ")}`,
          userRoles: userRoles // Incluir los roles del usuario para debugging
        });
      }

      // El usuario tiene un rol permitido, continuar
      next();

    } catch (error) {
      // Manejo de errores inesperados
      console.error("Error en roleMiddleware:", error);
      return res.status(500).json({
        success: false,
        message: "Error al verificar roles"
      });
    }
  };
};

module.exports = roleMiddleware;










