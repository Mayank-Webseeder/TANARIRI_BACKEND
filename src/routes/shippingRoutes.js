// routes/delhiveryRoutes.js
import express from "express";
import {
  getPincodeServiceability,
  getBulkWaybills,
  getExpectedTAT,
  createCMU,
  editPickup,
  mapEwaybill,
  trackShipment,
  getInvoiceCharges,
  getPackingSlip,
  requestPickup,
  createClientWarehouse,
  editClientWarehouse
} from "../controllers/delhiveryController.js";

import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

const router = express.Router();

// GET APIs
router.get("/pincode", authenticate, getPincodeServiceability);
router.get("/waybills", authenticate, getBulkWaybills);
router.get("/expected-tat", authenticate, getExpectedTAT);
router.get("/track/:waybill?", authenticate, trackShipment);
router.get("/invoice-charges", authenticate, getInvoiceCharges);
router.get("/packing-slip", authenticate, getPackingSlip);

// POST APIs
router.post("/cmu/create", authenticate, createCMU);
router.post("/pickup/edit", authenticate, editPickup);
router.post("/pickup/request", authenticate, requestPickup);
router.post("/warehouse/edit", authenticate, editClientWarehouse);

// PUT APIs
router.put("/warehouse/create", authenticate, createClientWarehouse);
router.put("/ewaybill/:ewbn", authenticate, mapEwaybill);

export default router;
