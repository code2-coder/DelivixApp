
const API_TOKEN = process.env.DELHIVERY_API_TOKEN;
const DELHIVERY_BASE_URL = process.env.DELHIVERY_BASE_URL || "https://track.delhivery.com/c/api";

/**
 * Check if a pincode is serviceable
 * @param {string} pincode - The pincode to check
 * @returns {Promise<Object>} - Serviceability details
 */
export const checkServiceability = async (pincode) => {
  if (!API_TOKEN) {
    console.warn("Delhivery API token is not configured. Bypassing serviceability check.");
    return {
      isServiceable: true,
      prepaid: true,
      cod: true,
      city: "Unknown",
      state: "Unknown"
    };
  }

  const serviceabilityUrl = `${DELHIVERY_BASE_URL}/pin-codes/json/?token=${API_TOKEN}&filter_codes=${pincode}`;

  try {
    const response = await fetch(serviceabilityUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Token ${API_TOKEN}`,
      },
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Failed to check serviceability: ${response.status} ${response.statusText} - ${text}`);
    }

    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON response: ${text}`);
    }

    if (result.delivery_codes && result.delivery_codes.length > 0) {
      const codeData = result.delivery_codes[0].postal_code;
      const isServiceable = codeData.pre_paid === "Y" || codeData.cod === "Y";
      return {
        isServiceable,
        prepaid: codeData.pre_paid === "Y",
        cod: codeData.cod === "Y",
        city: codeData.city,
        state: codeData.state_code
      };
    } else {
      return { isServiceable: false };
    }
  } catch (error) {
    console.error("Delhivery Serviceability API Exception:", error.message);
    throw new Error(`Delhivery Integration Error: ${error.message}`);
  }
};
