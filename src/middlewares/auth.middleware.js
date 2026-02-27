/**
 * Middleware de Autenticación y Autorización
 * 
 * Este archivo contiene middlewares para validar tokens JWT y verificar roles de usuario.
 * 
 * Middlewares:
 * - verifyToken: Valida el token JWT y adjunta el payload en req.user
 * - requireRole: Verifica que el usuario tenga un rol específico
 */

const jwt = require("jsonwebtoken");

/**
 * Middleware para verificar y validar el token JWT
 * 
 * Lee el token desde el header Authorization: Bearer <token>
 * Valida el JWT con JWT_SECRET
 * Si es válido, adjunta el payload decodificado en req.user
 * 
 * Maneja errores:
 * - Token ausente → 401
 * - Token inválido o expirado → 401
 */
const verifyToken = (req, res, next) => {
  try {
    // Extraer el token del header Authorization
    // Formato esperado: Authorization: Bearer <token>
    const authHeader = req.headers.authorization;

    // Validar que el header Authorization existe
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Token de autenticación requerido. Usa: Authorization: Bearer <token>"
      });
    }

    // Separar "Bearer" del token
    const parts = authHeader.trim().split(/\s+/);

    // Validar que el formato sea correcto (Bearer <token>)
    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
      return res.status(401).json({
        success: false,
        message: "Formato de token inválido. Usa: Authorization: Bearer <token>"
      });
    }

    // Extraer el token
    const token = parts[1];

    // Validar que JWT_SECRET esté definido
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET no está definido en las variables de entorno");
      return res.status(500).json({
        success: false,
        message: "Error de configuración del servidor"
      });
    }

    // Verificar y decodificar el token usando JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Adjuntar el payload decodificado en req.user
    // El payload contiene: userId, email, roles
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      roles: decoded.roles || []
    };

    // Continuar con el siguiente middleware o controlador
    next();

  } catch (error) {
    // Manejar diferentes tipos de errores de JWT
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Token inválido"
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expirado. Por favor, inicia sesión nuevamente"
      });
    }

    // Otros errores
    console.error("Error en verifyToken:", error);
    return res.status(401).json({
      success: false,
      message: "Error al validar el token"
    });
  }
};

/**
 * Middleware factory para verificar que el usuario tenga un rol específico
 * 
 * @param {string} role - Rol requerido ('conductor' o 'pasajero')
 * @returns {Function} Middleware de Express
 * 
 * Verifica que req.user.roles exista y sea un array
 * Valida que incluya el rol requerido
 * Si no cumple → 403
 */
const requireRole = (role) => {
  return (req, res, next) => {
    try {
      // Verificar que req.user existe (debe ser inyectado por verifyToken primero)
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado. Usa verifyToken antes de requireRole"
        });
      }

      // Verificar que req.user.roles existe y sea un array
      if (!req.user.roles || !Array.isArray(req.user.roles)) {
        return res.status(403).json({
          success: false,
          message: "Acceso denegado. El usuario no tiene roles asignados"
        });
      }

      // Validar que el array de roles incluya el rol requerido
      if (!req.user.roles.includes(role)) {
        return res.status(403).json({
          success: false,
          message: `Acceso denegado. Se requiere el rol: ${role}`
        });
      }

      // El usuario tiene el rol requerido, continuar
      next();

    } catch (error) {
      // Manejo de errores inesperados
      console.error("Error en requireRole:", error);
      return res.status(500).json({
        success: false,
        message: "Error al verificar roles"
      });
    }
  };
};

// Exportar ambos middlewares
// También exportar verifyToken como función directa para mantener compatibilidad con código existente
module.exports = verifyToken;
module.exports.verifyToken = verifyToken;
module.exports.requireRole = requireRole;
