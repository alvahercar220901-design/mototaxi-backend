const supabase = require("../config/supabase");

/** Estados válidos del viaje */
const ESTADOS_VIAJE = ["buscando", "asignado", "en_progreso", "finalizado", "cancelado"];

/**
 * Pasajero solicita un viaje (solo rol pasajero, validado por middleware).
 */
const requestTrip = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "No autorizado: usuario no autenticado"
      });
    }

    const pasajeroId = req.user.userId;

    // Verificar si el pasajero ya tiene un viaje activo (excluyendo cancelado y finalizado)
    const estadosActivos = ["buscando", "asignado", "en_progreso"];
    const { data: viajesActivos, error: errorConsulta } = await supabase
      .from("trips")
      .select("id")
      .eq("pasajero_id", pasajeroId)
      .in("estado", estadosActivos);

    if (errorConsulta) {
      console.error("Error al consultar viajes activos:", errorConsulta);
      return res.status(500).json({
        success: false,
        message: "Error interno"
      });
    }

    if (viajesActivos && viajesActivos.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Ya tienes un viaje activo"
      });
    }

    // Conductores disponibles desde Supabase: tabla drivers (rol conductor + estado disponible)
    const { data: conductoresDisponibles, error: errorConductores } = await supabase
      .from("drivers")
      .select("user_id")
      .eq("estado", "disponible");

    if (errorConductores) {
      console.error("Error al consultar conductores:", errorConductores);
      return res.status(500).json({
        success: false,
        message: "Error interno"
      });
    }

    const hayConductores = conductoresDisponibles && conductoresDisponibles.length > 0;
    if (!hayConductores) {
      return res.status(503).json({
        success: false,
        message: "No hay conductores disponibles"
      });
    }

    // Crear viaje en Supabase con pasajero_id como UUID
    const { data: nuevoViaje, error: errorCreacion } = await supabase
      .from("trips")
      .insert({
        pasajero_id: pasajeroId,
        estado: "buscando"
      })
      .select()
      .single();

    if (errorCreacion) {
      console.error("Error al crear viaje:", errorCreacion);
      return res.status(500).json({
        success: false,
        message: "Error interno"
      });
    }

    res.status(201).json({
      success: true,
      message: "Viaje creado, buscando conductor",
      data: {
        trip: nuevoViaje,
        conductorSugerido: conductoresDisponibles[0] || null
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error interno"
    });
  }
};

/**
 * Conductor acepta un viaje.
 * Reglas: solo rol conductor, sin viaje activo, viaje en "buscando".
 * Transición: buscando → asignado; conductor_id y accepted_at; conductor → ocupado.
 */
const acceptTrip = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "No autorizado: usuario no autenticado"
      });
    }

    // Solo conductores pueden aceptar viajes (403 si no tiene rol)
    const roles = req.user.roles || [];
    if (!roles.includes("conductor")) {
      return res.status(403).json({
        success: false,
        message: "Solo los conductores pueden aceptar viajes"
      });
    }

    const { tripId } = req.body;
    const conductorId = req.user.userId;

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "tripId es requerido"
      });
    }

    // Validar que el conductor exista en tabla drivers y esté disponible
    const { data: driver, error: errorDriverConsulta } = await supabase
      .from("drivers")
      .select("user_id, estado")
      .eq("user_id", conductorId)
      .single();

    if (errorDriverConsulta || !driver) {
      return res.status(404).json({
        success: false,
        message: "Conductor no encontrado en el sistema"
      });
    }

    if (driver.estado !== "disponible") {
      return res.status(400).json({
        success: false,
        message: "El conductor no está disponible. Estado actual: " + (driver.estado || "desconocido")
      });
    }

    // El conductor NO puede tener otro viaje activo (asignado o en_progreso) → 409
    const estadosActivosConductor = ["asignado", "en_progreso"];
    const { data: viajesActivosConductor, error: errorConsultaConductor } = await supabase
      .from("trips")
      .select("id")
      .eq("conductor_id", conductorId)
      .in("estado", estadosActivosConductor);

    if (errorConsultaConductor) {
      console.error("Error al consultar viajes activos del conductor:", errorConsultaConductor);
      return res.status(500).json({
        success: false,
        message: "Error interno"
      });
    }

    if (viajesActivosConductor && viajesActivosConductor.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Ya tienes un viaje activo. No puedes aceptar otro."
      });
    }

    // Obtener el viaje (UUID tal cual; 404 si no existe)
    const { data: viajeActual, error: errorConsultaViaje } = await supabase
      .from("trips")
      .select("id, estado")
      .eq("id", tripId)
      .single();

    if (errorConsultaViaje) {
      if (errorConsultaViaje.code === "PGRST116") {
        return res.status(404).json({
          success: false,
          message: "Viaje no encontrado"
        });
      }
      console.error("Error al consultar viaje:", errorConsultaViaje);
      return res.status(500).json({
        success: false,
        message: "Error interno"
      });
    }

    if (!viajeActual) {
      return res.status(404).json({
        success: false,
        message: "Viaje no encontrado"
      });
    }

    // El viaje DEBE estar en estado "buscando" → 400 si transición inválida
    if (viajeActual.estado !== "buscando") {
      return res.status(400).json({
        success: false,
        message: "Transición de estado no válida. El viaje debe estar en estado 'buscando'."
      });
    }

    // Actualizar viaje: buscando → asignado, conductor_id, accepted_at (solo si sigue en buscando, evita carreras)
    const { data: viajeActualizado, error: errorActualizacion } = await supabase
      .from("trips")
      .update({
        conductor_id: conductorId,
        estado: "asignado",
        accepted_at: new Date().toISOString()
      })
      .eq("id", tripId)
      .eq("estado", "buscando")
      .select()
      .single();

    if (errorActualizacion) {
      console.error("Error al actualizar viaje:", errorActualizacion);
      return res.status(500).json({
        success: false,
        message: "Error interno"
      });
    }

    if (!viajeActualizado) {
      return res.status(400).json({
        success: false,
        message: "El viaje ya no está disponible (estado cambió)"
      });
    }

    // Conductor pasa a estado ocupado en la tabla drivers
    const { error: errorDriver } = await supabase
      .from("drivers")
      .update({ estado: "ocupado" })
      .eq("user_id", conductorId);

    if (errorDriver) {
      console.error("Error al actualizar estado del conductor:", errorDriver);
      return res.status(500).json({
        success: false,
        message: "Error interno"
      });
    }

    res.json({
      success: true,
      message: "Viaje aceptado",
      data: viajeActualizado
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error interno"
    });
  }
};

/**
 * Conductor inicia un viaje (solo conductor asignado, estado asignado → en_progreso).
 */
const startTrip = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "No autorizado: usuario no autenticado"
      });
    }

    const { tripId } = req.body;
    const conductorId = req.user.userId;

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "tripId es requerido"
      });
    }

    const { data: viajeActual, error: errorConsulta } = await supabase
      .from("trips")
      .select("id, estado, conductor_id")
      .eq("id", tripId)
      .single();

    if (errorConsulta) {
      if (errorConsulta.code === "PGRST116") {
        return res.status(404).json({
          success: false,
          message: "Viaje no encontrado"
        });
      }
      console.error("Error al consultar viaje:", errorConsulta);
      return res.status(500).json({
        success: false,
        message: "Error interno"
      });
    }

    if (!viajeActual) {
      return res.status(404).json({
        success: false,
        message: "Viaje no encontrado"
      });
    }

    if (viajeActual.conductor_id !== conductorId) {
      return res.status(403).json({
        success: false,
        message: "Solo el conductor asignado puede iniciar este viaje"
      });
    }

    if (viajeActual.estado !== "asignado") {
      return res.status(400).json({
        success: false,
        message: "Transición de estado no válida. El viaje debe estar en estado 'asignado'."
      });
    }

    const { data: viajeActualizado, error: errorActualizacion } = await supabase
      .from("trips")
      .update({
        estado: "en_progreso",
        started_at: new Date().toISOString()
      })
      .eq("id", tripId)
      .select()
      .single();

    if (errorActualizacion) {
      console.error("Error al iniciar viaje:", errorActualizacion);
      return res.status(500).json({
        success: false,
        message: "Error interno"
      });
    }

    if (!viajeActualizado) {
      return res.status(404).json({
        success: false,
        message: "Viaje no encontrado"
      });
    }

    res.json({
      success: true,
      message: "Viaje iniciado",
      data: viajeActualizado
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error interno"
    });
  }
};

/**
 * Obtener viajes de un pasajero
 */
const getTripsByPasajero = async (req, res) => {
  try {
    // Validar que req.user y req.user.userId existan
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "No autorizado: usuario no autenticado"
      });
    }

    const pasajeroId = req.user.userId;

    // Consultar viajes en Supabase usando pasajero_id como UUID
    const { data: pasajeroTrips, error: errorConsulta } = await supabase
      .from("trips")
      .select("*")
      .eq("pasajero_id", pasajeroId)
      .order("created_at", { ascending: false });

    if (errorConsulta) {
      console.error("Error al consultar viajes:", errorConsulta);
      return res.status(500).json({
        success: false,
        message: "Error interno"
      });
    }

    res.status(200).json({
      success: true,
      data: pasajeroTrips || []
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error interno"
    });
  }
};

/**
 * Obtener viajes de un conductor
 */
const getTripsByConductor = async (req, res) => {
  try {
    // Validar que req.user y req.user.userId existan
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "No autorizado: usuario no autenticado"
      });
    }

    const conductorId = req.user.userId;

    // Consultar viajes en Supabase usando conductor_id como UUID
    const { data: conductorTrips, error: errorConsulta } = await supabase
      .from("trips")
      .select("*")
      .eq("conductor_id", conductorId)
      .order("created_at", { ascending: false });

    if (errorConsulta) {
      console.error("Error al consultar viajes:", errorConsulta);
      return res.status(500).json({
        success: false,
        message: "Error interno"
      });
    }

    res.status(200).json({
      success: true,
      data: conductorTrips || []
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error interno"
    });
  }
};

/**
 * Obtener un viaje por ID
 */
const getTripById = async (req, res) => {
  try {
    const { id } = req.params;

    // Consultar viaje en Supabase por ID (UUID)
    const { data: trip, error: errorConsulta } = await supabase
      .from("trips")
      .select("*")
      .eq("id", id)
      .single();

    if (errorConsulta) {
      console.error("Error al consultar viaje:", errorConsulta);
      return res.status(500).json({
        success: false,
        message: "Error interno"
      });
    }

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Viaje no encontrado"
      });
    }

    res.status(200).json({
      success: true,
      data: trip
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error interno"
    });
  }
};

/**
 * Finalizar un viaje (solo el conductor asignado; rol conductor validado por middleware).
 */
const finishTrip = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "No autorizado: usuario no autenticado"
      });
    }

    const { tripId } = req.body;
    const conductorId = req.user.userId;

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "tripId es requerido"
      });
    }

    const { data: viajeActual, error: errorConsultaViaje } = await supabase
      .from("trips")
      .select("id, estado, conductor_id")
      .eq("id", tripId)
      .single();

    if (errorConsultaViaje) {
      if (errorConsultaViaje.code === "PGRST116") {
        return res.status(404).json({
          success: false,
          message: "Viaje no encontrado"
        });
      }
      console.error("Error al consultar viaje:", errorConsultaViaje);
      return res.status(500).json({
        success: false,
        message: "Error interno"
      });
    }

    if (!viajeActual) {
      return res.status(404).json({
        success: false,
        message: "Viaje no encontrado"
      });
    }

    if (viajeActual.conductor_id !== conductorId) {
      return res.status(403).json({
        success: false,
        message: "Solo el conductor asignado puede finalizar este viaje"
      });
    }

    if (viajeActual.estado !== "en_progreso") {
      return res.status(400).json({
        success: false,
        message: "Transición de estado no válida. El viaje debe estar en estado 'en_progreso'."
      });
    }

    const { data: viajeActualizado, error: errorActualizacion } = await supabase
      .from("trips")
      .update({
        estado: "finalizado",
        finished_at: new Date().toISOString()
      })
      .eq("id", tripId)
      .eq("estado", "en_progreso")
      .select()
      .single();

    if (errorActualizacion) {
      console.error("Error al finalizar viaje:", errorActualizacion);
      return res.status(500).json({
        success: false,
        message: "Error interno"
      });
    }

    if (!viajeActualizado) {
      return res.status(404).json({
        success: false,
        message: "Viaje no encontrado"
      });
    }

    const { error: errorDriver } = await supabase
      .from("drivers")
      .update({ estado: "disponible" })
      .eq("user_id", conductorId);

    if (errorDriver) {
      console.error("Error al actualizar estado del conductor:", errorDriver);
      return res.status(500).json({
        success: false,
        message: "Error interno"
      });
    }

    res.status(200).json({
      success: true,
      data: viajeActualizado
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error interno"
    });
  }
};

/**
 * Cancelar un viaje.
 * Buscando: solo actualizar trip a cancelado.
 * Asignado: actualizar trip y liberar conductor.
 * En progreso: solo el conductor puede cancelar; actualizar trip y liberar conductor.
 */
const cancelTrip = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "No autorizado: usuario no autenticado"
      });
    }

    const { tripId } = req.body;
    const userId = req.user.userId;
    const roles = req.user.roles || [];

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "tripId es requerido"
      });
    }

    const { data: viajeActual, error: errorConsulta } = await supabase
      .from("trips")
      .select("id, estado, pasajero_id, conductor_id")
      .eq("id", tripId)
      .single();

    if (errorConsulta) {
      if (errorConsulta.code === "PGRST116") {
        return res.status(404).json({
          success: false,
          message: "Viaje no encontrado"
        });
      }
      console.error("Error al consultar viaje:", errorConsulta);
      return res.status(500).json({
        success: false,
        message: "Error interno"
      });
    }

    if (!viajeActual) {
      return res.status(404).json({
        success: false,
        message: "Viaje no encontrado"
      });
    }

    if (viajeActual.estado === "finalizado") {
      return res.status(400).json({
        success: false,
        message: "No se puede cancelar un viaje finalizado"
      });
    }

    if (viajeActual.estado === "cancelado") {
      return res.status(400).json({
        success: false,
        message: "El viaje ya está cancelado"
      });
    }

    const esPasajero = roles.includes("pasajero") && viajeActual.pasajero_id === userId;
    const esConductor = roles.includes("conductor") && viajeActual.conductor_id === userId;

    if (!esPasajero && !esConductor) {
      return res.status(403).json({
        success: false,
        message: "No tienes permisos para cancelar este viaje"
      });
    }

    // En 'en_progreso' solo el conductor puede cancelar
    if (viajeActual.estado === "en_progreso") {
      if (!esConductor) {
        return res.status(403).json({
          success: false,
          message: "Solo el conductor puede cancelar un viaje en progreso"
        });
      }
      // esConductor: se permite cancelar; más abajo se actualiza trip y se libera conductor
    }

    if (esPasajero && viajeActual.estado !== "buscando" && viajeActual.estado !== "asignado") {
      return res.status(400).json({
        success: false,
        message: "Transición de estado no válida"
      });
    }

    if (esConductor && viajeActual.estado === "asignado") {
      // Conductor puede cancelar en asignado; permitido, sigue el flujo
    } else if (esConductor && viajeActual.estado !== "en_progreso") {
      return res.status(400).json({
        success: false,
        message: "El conductor solo puede cancelar viajes en estado 'asignado' o 'en_progreso'"
      });
    }

    const cancelledBy = esPasajero ? "pasajero" : "conductor";

    const { data: viajeActualizado, error: errorActualizacion } = await supabase
      .from("trips")
      .update({
        estado: "cancelado",
        cancelled_at: new Date().toISOString(),
        cancelled_by: cancelledBy
      })
      .eq("id", tripId)
      .select()
      .single();

    if (errorActualizacion) {
      console.error("Error al cancelar viaje:", errorActualizacion);
      return res.status(500).json({
        success: false,
        message: "Error interno"
      });
    }

    if (!viajeActualizado) {
      return res.status(404).json({
        success: false,
        message: "Viaje no encontrado"
      });
    }

    if (viajeActual.conductor_id) {
      const { error: errorDriver } = await supabase
        .from("drivers")
        .update({ estado: "disponible" })
        .eq("user_id", viajeActual.conductor_id);

      if (errorDriver) {
        console.error("Error al actualizar estado del conductor:", errorDriver);
      }
    }

    res.status(200).json({
      success: true,
      data: viajeActualizado
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
  requestTrip,
  acceptTrip,
  startTrip,
  getTripsByPasajero,
  getTripsByConductor,
  getTripById,
  finishTrip,
  cancelTrip
};
