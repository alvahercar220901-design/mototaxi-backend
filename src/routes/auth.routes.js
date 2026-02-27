/**
 * Rutas de Autenticación
 * 
 * Este archivo define las rutas relacionadas con la autenticación de usuarios.
 * Todas las rutas tienen el prefijo /auth
 * 
 * Rutas disponibles:
 * - POST /auth/register - Registra un nuevo usuario
 * - POST /auth/login - Autentica un usuario existente
 */

const express = require("express");
const router = express.Router();

// Importar controlador de autenticación
const authController = require("../controllers/auth.controller");

/**
 * POST /auth/register
 * 
 * Registra un nuevo usuario en el sistema.
 * 
 * Body esperado:
 * {
 *   "email": "usuario@ejemplo.com",
 *   "password": "contraseña123",
 *   "nombre": "Juan Pérez",
 *   "telefono": "1234567890"
 * }
 */
router.post("/register", authController.register);

/**
 * POST /auth/login
 * 
 * Autentica un usuario existente.
 * 
 * Body esperado:
 * {
 *   "email": "usuario@ejemplo.com",
 *   "password": "contraseña123"
 * }
 */
router.post("/login", authController.login);

// Exportar el router para usarlo en app.js
module.exports = router;














