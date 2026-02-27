/**
 * Rutas de Prueba
 * 
 * Este archivo contiene rutas de prueba para verificar el funcionamiento
 * de los middlewares de autenticación y autorización por roles.
 */

const express = require("express");
const router = express.Router();

// Importar middlewares de autenticación y autorización
const { verifyToken, requireRole } = require("../middlewares/auth.middleware");

/**
 * GET /test/conductor
 * 
 * Ruta de prueba que requiere:
 * - Token JWT válido (verifyToken)
 * - Rol de conductor (requireRole('conductor'))
 * 
 * Responde con un JSON simple confirmando acceso autorizado
 */
router.get("/conductor", verifyToken, requireRole("conductor"), (req, res) => {
  res.status(200).json({
    success: true,
    message: "Acceso autorizado para conductores",
    data: {
      userId: req.user.userId,
      email: req.user.email,
      roles: req.user.roles
    }
  });
});

module.exports = router;

