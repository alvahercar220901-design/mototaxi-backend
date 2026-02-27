const express = require("express");
const router = express.Router();

const tripController = require("../controllers/trip.controller");

// Importar middleware de autenticación
// Este middleware valida el token JWT y agrega req.user con los datos del usuario
const authMiddleware = require("../middlewares/auth.middleware");

// Importar middleware de roles para control de acceso por tipo de usuario
const roleMiddleware = require("../middlewares/role.middleware");

// Todas las rutas están protegidas con autenticación JWT
// El middleware valida el token desde el header Authorization: Bearer <token>
//
// IMPORTANTE: estas rutas específicas deben ir ANTES de "/:id" para no chocar con params.
router.get("/pasajero", authMiddleware, roleMiddleware(["pasajero"]), tripController.getTripsByPasajero);
router.get("/conductor", authMiddleware, roleMiddleware(["conductor"]), tripController.getTripsByConductor);

router.get("/:id", authMiddleware, tripController.getTripById);
router.post("/request", authMiddleware, roleMiddleware(["pasajero"]), tripController.requestTrip);
router.post("/accept", authMiddleware, roleMiddleware(["conductor"]), tripController.acceptTrip);
router.post("/start", authMiddleware, roleMiddleware(["conductor"]), tripController.startTrip);
router.post("/finish", authMiddleware, roleMiddleware(["conductor"]), tripController.finishTrip);
router.post("/cancel", authMiddleware, roleMiddleware(["pasajero", "conductor"]), tripController.cancelTrip);

module.exports = router;
