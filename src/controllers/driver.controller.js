// Simulación de base de datos
// Array exportable para mantener los conductores en memoria
const drivers = [];

/**
 * Registra un nuevo conductor en el sistema
 * 
 * @param {Object} req - Objeto de petición de Express
 * @param {Object} req.user - Datos del usuario autenticado (inyectado por verifyToken)
 * @param {Object} res - Objeto de respuesta de Express
 */
const registerDriver = (req, res) => {
  try {
    // Extraer userId del usuario autenticado (inyectado por verifyToken)
    const userId = req.user.userId;

    // Verificar si ya existe un conductor con ese userId (evitar duplicados)
    const existingDriver = drivers.find(d => d.userId === userId);
    if (existingDriver) {
      return res.status(409).json({
        success: false,
        message: "Ya existe un conductor registrado con ese userId"
      });
    }

    // Crear nuevo conductor con los campos requeridos
    const newDriver = {
      userId,
      estado: "disponible", // Estado inicial siempre es "disponible"
      createdAt: new Date() // Fecha de creación del registro
    };

    // Guardar el conductor en el array (simulación de BD)
    drivers.push(newDriver);

    // Responder con éxito y status 201 (Created)
    res.status(201).json({
      success: true,
      message: "Conductor registrado correctamente",
      data: newDriver
    });

  } catch (error) {
    // Manejo de errores inesperados
    console.error("Error en registerDriver:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor"
    });
  }
};

/**
 * Actualiza el estado del conductor
 * Body esperado:
 * {
 *   "estado": "disponible" | "ocupado" | "offline"
 * }
 */
const updateStatus = (req, res) => {
  try {
    const { estado } = req.body;
    const userId = req.user.userId;

    if (!estado) {
      return res.status(400).json({
        success: false,
        message: "estado es requerido"
      });
    }

    const estadosPermitidos = ["disponible", "ocupado", "offline"];
    if (!estadosPermitidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        message: "estado no válido. Valores permitidos: disponible, ocupado, offline"
      });
    }

    let driver = drivers.find(d => d.userId === userId);

    // Si no existe, lo creamos
    if (!driver) {
      driver = {
        userId,
        estado,
        activoHasta: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 día
        lastUpdate: new Date()
      };
      drivers.push(driver);
    } else {
      driver.estado = estado;
      driver.lastUpdate = new Date();
    }

    res.json({
      success: true,
      message: "Estado del conductor actualizado",
      data: driver
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error interno"
    });
  }
};

module.exports = {
  drivers, // Array exportable para mantener los conductores en memoria
  registerDriver,
  updateStatus
};
