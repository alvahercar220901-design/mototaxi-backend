-- Función para obtener conductores disponibles más cercanos al pasajero.
-- Ejecutar en el SQL Editor de Supabase (Dashboard > SQL Editor).
--
-- Requiere que la tabla drivers tenga columnas: user_id, estado, lat, lng

CREATE OR REPLACE FUNCTION get_nearby_drivers(
  passenger_lat double precision,
  passenger_lng double precision
)
RETURNS TABLE (
  user_id uuid,
  lat double precision,
  lng double precision,
  distancia_km double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    d.user_id,
    d.lat,
    d.lng,
    -- Haversine: distancia en km (R = 6371)
    (6371 * 2 * asin(sqrt(
      power(sin(radians(d.lat - passenger_lat) / 2), 2)
      + cos(radians(passenger_lat)) * cos(radians(d.lat))
      * power(sin(radians(d.lng - passenger_lng) / 2), 2)
    )))::double precision AS distancia_km
  FROM drivers d
  WHERE d.estado = 'disponible'
    AND d.lat IS NOT NULL
    AND d.lng IS NOT NULL
  ORDER BY distancia_km
  LIMIT 5;
$$;
