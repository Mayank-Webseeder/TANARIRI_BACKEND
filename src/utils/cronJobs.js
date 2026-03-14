import cron from "node-cron";
import Order from "../models/Order.js";
import axios from "axios";

const trackOrders = async () => {
  try {
    const orders = await Order.find({
      status: { $in: ["shipped", "in_transit"] },
      waybill: { $ne: null },
    });

    for (const order of orders) {
      try {
        const res = await axios.get(
          `https://track.delhivery.com/api/v1/packages/json/?waybill=${order.waybill}`,
          {
            headers: {
              Authorization: `Token 7c61e302ae5975c0ad42d6bb555b5b12c9ee3b9c`,
            },
          },
        );

        const trackingData = res.data?.ShipmentData?.[0]?.Shipment;

        if (trackingData) {
          const currentStatus = trackingData.Status?.Status;

          if (currentStatus) {
            order.trackingStatus = currentStatus;

            const statusLower = currentStatus.toLowerCase();

            if (statusLower.includes("delivered")) {
              order.status = "delivered";
            } else if (
              statusLower.includes("transit") ||
              statusLower.includes("dispatched")
            ) {
              order.status = "in_transit";
            } else if (statusLower.includes("rto")) {
              order.status = "cancelled";
            }

            await order.save();
          }
        }
      } catch (err) {
        console.error(err.message);
      }
    }
  } catch (error) {
    console.error(error.message);
  }
};

cron.schedule("0 */2 * * *", trackOrders);
// Test Case
// cron.schedule("* * * * *", () => {
//   console.log("Testing Cron: Fetching Delhivery Updates...");
//   trackOrders();
// });
export default trackOrders;
