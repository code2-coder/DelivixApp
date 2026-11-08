/**
 * Build a courier tracking URL only when the courier is known. We never invent
 * tracking events or URLs for couriers we do not recognise.
 */
export const buildCourierTrackingUrl = (courierName, trackingNumber) => {
  if (!courierName || !trackingNumber) return null;
  const name = String(courierName).toLowerCase();
  if (name.includes("delhivery")) return `https://www.delhivery.com/`;
  if (name.includes("bluedart")) {
    return `https://www.bluedart.com/tracking?trackFor=0&track=${encodeURIComponent(trackingNumber)}`;
  }
  if (name.includes("dtdc")) {
    return `https://www.dtdc.in/tracking.asp?podNo=${encodeURIComponent(trackingNumber)}`;
  }
  if (name.includes("ekart")) {
    return `https://ekartlogistics.com/shipmenttrack/${encodeURIComponent(trackingNumber)}`;
  }
  if (name.includes("india post")) {
    return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`;
  }
  return null;
};

export default { buildCourierTrackingUrl };
