const supabase = require("../config/supabase");

const ESTADOS_PERMITIDOS = ["disponible", "ocupado", "offline"];

/**
 * Registra un nuevo conductor en la tabla drivers (Supabase).
 */
const registerDriver = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "No autorizado: usuario no identificado"
      });
    }

    const { data: existing, error: errorFind } = await supabase
      .from("drivers")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (errorFind) {
      console.error("Error al verificar conductor:", errorFind);
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Ya existe un conductor registrado con ese userId"
      });
    }

    const { data: created, error: errorInsert } = await supabase
      .from("drivers")
      .insert({ user_id: userId, estado: "disponible" })
      .select()
      .single();

    if (errorInsert) {
      console.error("Error al registrar conductor:", errorInsert);
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }

    return res.status(201).json({
      success: true,
      message: "Conductor registrado correctamente",
      data: created
    });
  } catch (error) {
    console.error("Error en registerDriver:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor"
    });
  }
};

/**
 * Actualiza el estado del conductor. Si no existe registro, lo crea.
 */
const updateStatus = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { estado } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "No autorizado: usuario no identificado"
      });
    }

    if (!estado) {
      return res.status(400).json({
        success: false,
        message: "Estado es requerido"
      });
    }

    if (!ESTADOS_PERMITIDOS.includes(estado)) {
      return res.status(400).json({
        success: false,
        message: "Estado no válido. Valores permitidos: disponible, ocupado, offline"
      });
    }

    const { data: updateData, error: updateError } = await supabase
      .from("drivers")
      .update({ estado })
      .eq("user_id", userId)
      .select();

    if (updateError) {
      console.error("Error al actualizar estado del conductor:", updateError);
      return res.status(500).json({
        success: false,
        message: "Error al actualizar el estado del conductor"
      });
    }

    const updatedRows = updateData == null ? 0 : (Array.isArray(updateData) ? updateData.length : 1);

    if (updatedRows === 0) {
      const { data: insertData, error: insertError } = await supabase
        .from("drivers")
        .insert({ user_id: userId, estado })
        .select()
        .single();

      if (insertError) {
        console.error("Error al crear registro del conductor:", insertError);
        return res.status(500).json({
          success: false,
          message: "Error al crear el registro del conductor"
        });
      }

      return res.json({
        success: true,
        message: "Estado del conductor registrado",
        data: insertData
      });
    }

    return res.json({
      success: true,
      message: "Estado del conductor actualizado",
      data: updateData
    });
  } catch (error) {
    console.error("Error en updateStatus:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor"
    });
  }
};

module.exports = {
  registerDriver,
  updateStatus
};
