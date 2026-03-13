const supabase = require("../config/supabase");

// Mantener referencias de canales para evitar duplicados
let newTripsChannel = null;
const tripUpdateChannels = {};

/**
 * Suscripción a nuevos viajes en estado "buscando".
 * Escucha INSERT en la tabla "trips" filtrando por estado = 'buscando'.
 *
 * @param {Function} callback - Función que se llama con el viaje nuevo: callback(trip)
 * @returns {Function} unsubscribe - Función para cerrar el canal Realtime.
 */
function subscribeToNewTrips(callback) {
  if (typeof callback !== "function") {
    throw new Error("callback es requerido y debe ser una función");
  }

  // Evitar múltiples canales duplicados: cerrar el existente antes de crear uno nuevo
  if (newTripsChannel) {
    console.log("[realtime] Canal realtime-trips-new ya existe. Cerrando antes de crear uno nuevo.");
    supabase
      .removeChannel(newTripsChannel)
      .catch((error) => {
        console.error("[realtime] Error al cerrar canal previo realtime-trips-new:", error);
      });
    newTripsChannel = null;
  }

  const channel = supabase.channel("realtime-trips-new");
  newTripsChannel = channel;

  channel.on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "trips",
      filter: "estado=eq.buscando"
    },
    (payload) => {
      const trip = payload?.new;
      console.log("[realtime] Nuevo viaje en estado 'buscando':", trip);

      if (!trip) {
        return;
      }

      try {
        callback(trip);
      } catch (error) {
        console.error("[realtime] Error en callback de subscribeToNewTrips:", error);
      }
    }
  );

  // Log de cambios de estado del canal para depuración y reconexión
  channel.subscribe((status) => {
    console.log("[realtime] Canal realtime-trips-new estado:", status);
  });

  /**
   * Función para cerrar el canal Realtime.
   * Supabase maneja reconexión automática mientras el canal está activo;
   * esta función permite liberar recursos cuando ya no se requiere escuchar.
   */
  const unsubscribe = async () => {
    try {
      console.log("[realtime] Cerrando canal realtime-trips-new");
      await supabase.removeChannel(channel);
      if (newTripsChannel === channel) {
        newTripsChannel = null;
      }
    } catch (error) {
      console.error("[realtime] Error al cerrar canal realtime-trips-new:", error);
    }
  };

  return unsubscribe;
}

/**
 * Suscripción a actualizaciones de un viaje específico.
 * Escucha UPDATE en la tabla "trips" filtrando por id = tripId.
 *
 * @param {string} tripId - ID del viaje a escuchar.
 * @param {Function} callback - Función que se llama con el viaje actualizado: callback(updatedTrip)
 * @returns {Function} unsubscribe - Función para cerrar el canal Realtime.
 */
function subscribeToTripUpdates(tripId, callback) {
  if (!tripId) {
    throw new Error("tripId es requerido para subscribeToTripUpdates");
  }

  if (typeof callback !== "function") {
    throw new Error("callback es requerido y debe ser una función");
  }

  const channelName = `realtime-trip-updates-${tripId}`;
  const previousChannel = tripUpdateChannels[tripId];

  // Evitar múltiples canales duplicados para el mismo tripId
  if (previousChannel) {
    console.log(`[realtime] Canal ${channelName} ya existe. Cerrando antes de crear uno nuevo.`);
    supabase
      .removeChannel(previousChannel)
      .catch((error) => {
        console.error(`[realtime] Error al cerrar canal previo ${channelName}:`, error);
      });
    tripUpdateChannels[tripId] = null;
  }

  const channel = supabase.channel(channelName);
  tripUpdateChannels[tripId] = channel;

  channel.on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "trips",
      filter: `id=eq.${tripId}`
    },
    (payload) => {
      const updatedTrip = payload?.new;
      console.log(`[realtime] Actualización de viaje ${tripId}:`, updatedTrip);

      if (!updatedTrip) {
        return;
      }

      try {
        callback(updatedTrip);
      } catch (error) {
        console.error("[realtime] Error en callback de subscribeToTripUpdates:", error);
      }
    }
  );

  // Log de cambios de estado del canal para depuración y reconexión
  channel.subscribe((status) => {
    console.log(`[realtime] Canal ${channelName} estado:`, status);
  });

  /**
   * Función para cerrar el canal Realtime.
   * Supabase maneja reconexión automática mientras el canal está activo;
   * esta función permite liberar recursos cuando ya no se requiere escuchar.
   */
  const unsubscribe = async () => {
    try {
      console.log("[realtime] Cerrando canal", channelName);
      await supabase.removeChannel(channel);
      if (tripUpdateChannels[tripId] === channel) {
        delete tripUpdateChannels[tripId];
      }
    } catch (error) {
      console.error("[realtime] Error al cerrar canal", channelName, ":", error);
    }
  };

  return unsubscribe;
}

module.exports = {
  subscribeToNewTrips,
  subscribeToTripUpdates
};

