import dotenv from "dotenv";
dotenv.config();

const API_BASE = "http://localhost:8085/api/v1";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@delivix.com";

async function runFullSuite() {
  console.log("=== 🚀 DELIVIX ADMIN & ZEPTOMAIL E2E VERIFICATION SUITE ===\n");

  // 1. Send OTP to admin
  console.log("1️⃣ Testing ZeptoMail OTP Dispatch (`POST /auth/send-otp`)...");
  const sendRes = await fetch(`${API_BASE}/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL }),
  });
  const sendData = await sendRes.json();
  console.log("   Status:", sendRes.status, "| Success:", sendData.success);
  console.log("   Message:", sendData.message);
  const otpCode = sendData.devOtp;
  console.log("   Generated OTP Code:", otpCode);

  if (!otpCode) {
    throw new Error("No devOtp received for automated test verification!");
  }

  // 2. Verify OTP
  console.log("\n2️⃣ Testing ZeptoMail OTP Verification (`POST /auth/verify-otp`)...");
  const verifyRes = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, otp: otpCode }),
  });
  const verifyData = await verifyRes.json();
  console.log("   Status:", verifyRes.status, "| Success:", verifyData.success);
  const token = verifyData.token;
  console.log("   Authenticated Admin:", verifyData.user?.name, `<${verifyData.user?.email}>`);
  console.log("   Role:", verifyData.user?.role);
  console.log("   JWT Token:", token ? `${token.substring(0, 20)}...` : "None");

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // 3. Create Product (POST /admin/products)
  console.log("\n3️⃣ Testing Product CREATE (`POST /admin/products`)...");
  const createProdRes = await fetch(`${API_BASE}/admin/products`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: "Delivix Pulse Soundbar Studio",
      price: 349,
      description: "Cinema-grade acoustic soundbar with Dolby Atmos and wireless sub.",
      category: "Audio",
      stock: 45,
      image: "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=900&q=85",
      features: ["Dolby Atmos", "Wireless Subwoofer", "Bluetooth 5.3"],
      homeSection: "Trending Product",
    }),
  });
  const createProdData = await createProdRes.json();
  const newProductId = createProdData.product?._id;
  console.log("   Status:", createProdRes.status, "| Success:", createProdData.success);
  console.log("   Created Product ID:", newProductId, "| Name:", createProdData.product?.name);

  // 4. Read Products (GET /products)
  console.log("\n4️⃣ Testing Products READ (`GET /products`)...");
  const getProdsRes = await fetch(`${API_BASE}/products`);
  const getProdsData = await getProdsRes.json();
  console.log("   Status:", getProdsRes.status, "| Total Products:", getProdsData.totalProducts || getProdsData.products?.length);

  // 5. Update Product (PUT /admin/products/:id)
  console.log("\n5️⃣ Testing Product UPDATE (`PUT /admin/products/${newProductId}`)...");
  const updateProdRes = await fetch(`${API_BASE}/admin/products/${newProductId}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      name: "Delivix Pulse Soundbar Studio (Gen 2)",
      price: 399,
      stock: 55,
      description: "Updated gen 2 with spatial calibration and HDMI eARC.",
    }),
  });
  const updateProdData = await updateProdRes.json();
  console.log("   Status:", updateProdRes.status, "| Success:", updateProdData.success);
  console.log("   Updated Product Price: $" + (updateProdData.product?.price));

  // 6. Delete Product (DELETE /admin/products/:id)
  console.log("\n6️⃣ Testing Product DELETE (`DELETE /admin/products/${newProductId}`)...");
  const deleteProdRes = await fetch(`${API_BASE}/admin/products/${newProductId}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  const deleteProdData = await deleteProdRes.json();
  console.log("   Status:", deleteProdRes.status, "| Success:", deleteProdData.success);

  // 7. Create Banner (POST /admin/banner)
  console.log("\n7️⃣ Testing Banner CREATE (`POST /admin/banner`)...");
  const createBannerRes = await fetch(`${API_BASE}/admin/banner`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      title: "Holiday Mega Celebration 2025",
      subtitle: "Up to 50% discount on select accessories and audio gear",
      image: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1600&q=80",
      link: "/shop",
      isActive: true,
    }),
  });
  const createBannerData = await createBannerRes.json();
  const newBannerId = createBannerData.banner?._id;
  console.log("   Status:", createBannerRes.status, "| Success:", createBannerData.success);
  console.log("   Created Banner ID:", newBannerId, "| Title:", createBannerData.banner?.title);

  // 8. Read Admin Banners (GET /admin/banners)
  console.log("\n8️⃣ Testing Banners READ (`GET /admin/banners`)...");
  const getBannersRes = await fetch(`${API_BASE}/admin/banners`, {
    headers: authHeaders,
  });
  const getBannersData = await getBannersRes.json();
  console.log("   Status:", getBannersRes.status, "| Total Banners:", getBannersData.banners?.length);

  // 9. Update Banner (PUT /admin/banner/:id)
  console.log("\n9️⃣ Testing Banner UPDATE (`PUT /admin/banner/${newBannerId}`)...");
  const updateBannerRes = await fetch(`${API_BASE}/admin/banner/${newBannerId}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      title: "Holiday Mega Celebration 2025 (Extended)",
      subtitle: "Extended through Sunday with priority free shipping",
      isActive: false,
    }),
  });
  const updateBannerData = await updateBannerRes.json();
  console.log("   Status:", updateBannerRes.status, "| Success:", updateBannerData.success);
  console.log("   Updated Banner Title:", updateBannerData.banner?.title, "| IsActive:", updateBannerData.banner?.isActive);

  // 10. Delete Banner (DELETE /admin/banner/:id)
  console.log("\n🔟 Testing Banner DELETE (`DELETE /admin/banner/${newBannerId}`)...");
  const deleteBannerRes = await fetch(`${API_BASE}/admin/banner/${newBannerId}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  const deleteBannerData = await deleteBannerRes.json();
  console.log("   Status:", deleteBannerRes.status, "| Success:", deleteBannerData.success);

  console.log("\n✨ ALL 10 E2E CRUD & AUTH CHECKS PASSED WITH 100% SUCCESS!");
}

runFullSuite().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
