// controllers/delhiveryController.js
import axios from "axios";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Move to .env in production: process.env.DELHIVERY_TOKEN
const DELHIVERY_API_TOKEN = "7c61e302ae5975c0ad42d6bb555b5b12c9ee3b9c";

const BASE_URL = "https://track.delhivery.com";

// 1. Pincode Serviceability
export const getPincodeServiceability = asyncHandler(async (req, res) => {
  const { pincode } = req.query;
  if (!pincode) throw new ApiError(400, "pincode query param required");
  
  const response = await axios.get(
    `${BASE_URL}/c/api/pin-codes/json/?filter_codes=${pincode}`,
    { headers: getHeaders() }
  );
  
  res.json(new ApiResponse(200, "Pincode serviceability fetched", {
    pincode,
    data: response.data
  }));
});

// 2. Bulk Waybills
export const getBulkWaybills = asyncHandler(async (req, res) => {
  const { count } = req.query;
  if (!count) throw new ApiError(400, "count query param required");
  
  const response = await axios.get(
    `${BASE_URL}/waybill/api/bulk/json/?count=${count}&token=${DELHIVERY_API_TOKEN}`,
    { headers: { Accept: "application/json" } }
  );
  
  res.json(new ApiResponse(200, "Bulk waybills fetched", {
    count,
    data: response.data
  }));
});

// 3. Expected TAT
export const getExpectedTAT = asyncHandler(async (req, res) => {
  const { origin_pin, destination_pin, mot = "S", pdt = "B2C", expected_pickup_date } = req.query;
  if (!origin_pin || !destination_pin) throw new ApiError(400, "origin_pin & destination_pin required");
  
  const params = new URLSearchParams({
    origin_pin,
    destination_pin,
    mot,
    pdt,
    ...(expected_pickup_date && { expected_pickup_date })
  });
  
  const response = await axios.get(`${BASE_URL}/api/dc/expected_tat?${params}`, {
    headers: getHeaders()
  });
  
  res.json(new ApiResponse(200, "Expected TAT fetched", response.data));
});

// 4. Create CMU (Shipment)
export const createCMU = asyncHandler(async (req, res) => {
  const { shipments, pickup_location } = req.body;
  if (!shipments?.length || !pickup_location?.name) {
    throw new ApiError(400, "shipments array and pickup_location.name required");
  }
  
  const payload = {
    format: "json",
    data: { shipments, pickup_location }
  };
  
  const response = await axios.post(`${BASE_URL}/api/cmu/create.json`, payload, {
    headers: getHeaders()
  });
  
  res.json(new ApiResponse(201, "CMU created successfully", response.data));
});

// 5. Edit Pickup
export const editPickup = asyncHandler(async (req, res) => {
  const { waybill, pt, cod, shipment_height, weight, cancellation } = req.body;
  if (!waybill) throw new ApiError(400, "waybill required");
  
  const payload = { waybill };
  if (pt) payload.pt = pt;
  if (cod !== undefined) payload.cod = cod;
  if (shipment_height) payload.shipment_height = shipment_height;
  if (weight) payload.weight = weight;
  if (cancellation !== undefined) payload.cancellation = cancellation;
  
  const response = await axios.post(`${BASE_URL}/api/p/edit`, payload, {
    headers: getHeaders()
  });
  
  res.json(new ApiResponse(200, "Pickup edited successfully", response.data));
});

// 6. Ewaybill Mapping
export const mapEwaybill = asyncHandler(async (req, res) => {
  const { ewbn } = req.params;
  const { dcn } = req.body;
  if (!ewbn || !dcn) throw new ApiError(400, "ewbn param and dcn body required");
  
  const response = await axios.put(
    `${BASE_URL}/api/rest/ewaybill/${ewbn}/`,
    { data: [{ dcn, ewbn }] },
    { headers: getHeaders() }
  );
  
  res.json(new ApiResponse(200, "Ewaybill mapped successfully", response.data));
});

// 7. Shipment Tracking
export const trackShipment = asyncHandler(async (req, res) => {
  const { waybill, ref_ids } = req.query;
  if (!waybill) throw new ApiError(400, "waybill query param required");
  
  const params = new URLSearchParams({ waybill, ...(ref_ids && { ref_ids }) });
  const response = await axios.get(`${BASE_URL}/api/v1/packages/json/?${params}`, {
    headers: getHeaders()
  });
  
  res.json(new ApiResponse(200, "Shipment tracked successfully", response.data));
});

// 8. Invoice Charges
export const getInvoiceCharges = asyncHandler(async (req, res) => {
  const { md, ss, d_pin, o_pin, cgm, pt } = req.query;
  const required = ["md", "ss", "d_pin", "o_pin"];
  const missing = required.filter(p => !req.query[p]);
  if (missing.length) throw new ApiError(400, `${missing.join(", ")} required`);
  
  const params = new URLSearchParams({ md, ss, d_pin, o_pin, cgm, pt });
  const response = await axios.get(`${BASE_URL}/api/kinko/v1/invoice/charges/.json?${params}`, {
    headers: getHeaders()
  });
  
  res.json(new ApiResponse(200, "Invoice charges fetched", response.data));
});

// 9. Packing Slip
export const getPackingSlip = asyncHandler(async (req, res) => {
  const { wbns, pdf = "true", pdf_size = "4R" } = req.query;
  if (!wbns) throw new ApiError(400, "wbns query param required");
  
  const params = new URLSearchParams({ wbns, pdf, pdf_size });
  const response = await axios.get(`${BASE_URL}/api/p/packing_slip?${params}`, {
    headers: getHeaders(),
    responseType: "arraybuffer" // For PDF
  });
  
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename=packing-slip-${wbns}.pdf`
  });
  res.send(response.data);
});

// 10. Pickup Request
export const requestPickup = asyncHandler(async (req, res) => {
  const { pickup_time, pickup_date, pickup_location, expected_package_count } = req.body;
  if (!pickup_location || !pickup_date || !pickup_time) {
    throw new ApiError(400, "pickup_location, pickup_date, pickup_time required");
  }
  
  const response = await axios.post(`${BASE_URL}/fm/request/new/`, req.body, {
    headers: getHeaders()
  });
  
  res.json(new ApiResponse(201, "Pickup requested successfully", response.data));
});

// 11. Create Client Warehouse
export const createClientWarehouse = asyncHandler(async (req, res) => {
  const response = await axios.put(`${BASE_URL}/api/backend/clientwarehouse/create/`, req.body, {
    headers: getHeaders()
  });
  
  res.json(new ApiResponse(201, "Client warehouse created", response.data));
});

// 12. Edit Client Warehouse
export const editClientWarehouse = asyncHandler(async (req, res) => {
  const response = await axios.post(`${BASE_URL}/api/backend/clientwarehouse/edit/`, req.body, {
    headers: getHeaders()
  });
  
  res.json(new ApiResponse(200, "Client warehouse updated", response.data));
});

// Helper function
function getHeaders() {
  return {
    Authorization: `Token ${DELHIVERY_API_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json"
  };
}
