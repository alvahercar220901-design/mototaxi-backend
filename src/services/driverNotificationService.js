const supabase = require("../config/supabase");

const CHANNEL_NAME = "new-trip-notifications";
let notificationChannel = null;

/**
 * Inicia el servicio de notificación a conductores cercanos.
 * Escucha INSERT en la tabla trips y envía evento new_trip_request a cada conductor cercano.
 */
function startDriverNotificationService() {
  if (notificationChannel) {
    console.log("[driverNotification] Servicio ya iniciado. Canal existente.");
    return;
  }

  const channel = supabase.channel(CHANNEL_NAME);
  notificationChannel = channel;

  channel.on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "trips"
    },
    async (payload) => {
      const trip = payload?.new;
      if (!trip) {
        return;
      }

      const pickupLat = trip.pickup_lat;
      const pickupLng = trip.pickup_lng;

      if (pickupLat == null || pickupLng == null) {
        console.log("[driverNotification] Viaje sin pickup_lat/pickup_lng, se ignora:", trip.id);
        return;
      }

      if (trip.estado !== "buscando") {
        console.log("[driverNotification] Viaje no en estado buscando, se ignora:", trip.id);
        return;
      }

      try {
        const { data: conductoresCercanos, error: errorRpc } = await supabase.rpc("get_nearby_drivers", {
          passenger_lat: pickupLat,
          passenger_lng: pickupLng
        });

        if (errorRpc) {
          console.error("[driverNotification] Error al obtener conductores cercanos:", errorRpc);
          return;
        }

        const conductores = conductoresCercanos || [];
        if (conductores.length === 0) {
          console.log("[driverNotification] No hay conductores cercanos para viaje:", trip.id);
          return;
        }

        for (const conductor of conductores) {
          const driverId = conductor.user_id;
          channel.send({
            type: "broadcast",
            event: "new_trip_request",
            payload: {
              tripId: trip.id,
              pickup_lat: trip.pickup_lat,
              pickup_lng: trip.pickup_lng,
              driverId
            }
          });
          console.log("[driverNotification] Enviado new_trip_request a conductor:", driverId, "viaje:", trip.id);
        }
      } catch (error) {
        console.error("[driverNotification] Error procesando nuevo viaje:", error);
      }
    }
  );

  channel.subscribe((status) => {
    console.log("[driverNotification] Canal", CHANNEL_NAME, "estado:", status);
  });
}

module.exports = {
  startDriverNotificationService
};
