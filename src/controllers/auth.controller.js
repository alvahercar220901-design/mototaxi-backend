/**
 * Controlador de Autenticación
 *
 * Implementación lista para producción usando:
 * - Supabase como base de datos (tabla users)
 * - Bcrypt para hash de contraseñas
 * - JWT para autenticación basada en tokens
 */

const supabase = require("../config/supabase");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const ROLES_PERMITIDOS = ["pasajero", "conductor"];

/**
 * Registra un nuevo usuario en el sistema (tabla users en Supabase).
 *
 * @param {Object} req - Objeto de petición de Express
 * @param {Object} req.body - Datos del usuario (email, password, nombre, telefono, roles)
 * @param {Object} res - Objeto de respuesta de Express
 */
const register = async (req, res) => {
  try {
    const { email, password, nombre, telefono, roles } = req.body || {};

    if (!email || !password || !nombre || !telefono) {
      return res.status(400).json({
        success: false,
        message: "Faltan datos requeridos. Necesitas: email, password, nombre, telefono"
      });
    }

    if (roles === undefined || roles === null) {
      return res.status(400).json({
        success: false,
        message: "El campo 'roles' es obligatorio"
      });
    }

    if (!Array.isArray(roles)) {
      return res.status(400).json({
        success: false,
        message: "El campo 'roles' debe ser un array"
      });
    }

    if (roles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "El array 'roles' no puede estar vacío"
      });
    }

    const rolesInvalidos = roles.filter((role) => !ROLES_PERMITIDOS.includes(role));
    if (rolesInvalidos.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Roles no permitidos: ${rolesInvalidos.join(
          ", "
        )}. Valores permitidos: ${ROLES_PERMITIDOS.join(", ")}`
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "El formato del email no es válido"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "La contraseña debe tener al menos 6 caracteres"
      });
    }

    // Verificar si el email ya existe
    const { data: usersByEmail, error: errorEmail } = await supabase
      .from("users")
      .select("id")
      .eq("email", email);

    if (errorEmail) {
      console.error("Error al verificar email en Supabase:", errorEmail);
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }

    if (usersByEmail && usersByEmail.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Este email ya está registrado"
      });
    }

    // Verificar si el teléfono ya existe
    const { data: usersByPhone, error: errorPhone } = await supabase
      .from("users")
      .select("id")
      .eq("telefono", telefono);

    if (errorPhone) {
      console.error("Error al verificar teléfono en Supabase:", errorPhone);
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }

    if (usersByPhone && usersByPhone.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Este teléfono ya está registrado"
      });
    }

    // Hashear contraseña
    const passwordHasheada = await bcrypt.hash(password, 10);

    // Insertar usuario en Supabase
    const { data: nuevoUsuario, error: errorInsert } = await supabase
      .from("users")
      .insert({
        email,
        password: passwordHasheada,
        nombre,
        telefono,
        roles
      })
      .select("id, email, nombre, telefono, roles, created_at")
      .single();

    if (errorInsert) {
      // Manejo explícito de posibles violaciones de unicidad
      if (errorInsert.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "Email o teléfono ya registrado"
        });
      }

      console.error("Error al registrar usuario en Supabase:", errorInsert);
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }

    if (!nuevoUsuario) {
      return res.status(500).json({
        success: false,
        message: "No se pudo crear el usuario"
      });
    }

    return res.status(201).json({
      success: true,
      message: "Usuario registrado correctamente",
      data: {
        id: nuevoUsuario.id,
        email: nuevoUsuario.email,
        nombre: nuevoUsuario.nombre,
        telefono: nuevoUsuario.telefono,
        roles: nuevoUsuario.roles,
        created_at: nuevoUsuario.created_at
      }
    });
  } catch (error) {
    console.error("Error en register:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor"
    });
  }
};

/**
 * Autentica un usuario existente (login).
 *
 * @param {Object} req - Objeto de petición de Express
 * @param {Object} req.body - Credenciales del usuario (email, password)
 * @param {Object} res - Objeto de respuesta de Express
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Faltan datos requeridos. Necesitas: email, password"
      });
    }

    // Buscar usuario por email en Supabase
    const { data: user, error: errorUser } = await supabase
      .from("users")
      .select("id, email, password, nombre, telefono, roles")
      .eq("email", email)
      .single();

    if (errorUser) {
      // PGRST116 → no se encontraron filas
      if (errorUser.code === "PGRST116") {
        return res.status(401).json({
          success: false,
          message: "Credenciales inválidas"
        });
      }

      console.error("Error al buscar usuario en Supabase:", errorUser);
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Credenciales inválidas"
      });
    }

    const passwordValida = await bcrypt.compare(password, user.password);
    if (!passwordValida) {
      return res.status(401).json({
        success: false,
        message: "Credenciales inválidas"
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("JWT_SECRET no está definido en las variables de entorno");
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        roles: user.roles || []
      },
      jwtSecret,
      {
        expiresIn: "24h"
      }
    );

    return res.status(200).json({
      success: true,
      message: "Login exitoso",
      data: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        telefono: user.telefono,
        roles: user.roles || [],
        token
      }
    });
  } catch (error) {
    console.error("Error en login:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor"
    });
  }
};

module.exports = {
  register,
  login
};

