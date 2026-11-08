import dotenv from "dotenv";
dotenv.config();
import { connectDB, disconnectDB } from "../config/database.js";
import User from "../models/User.js";
import Order from "../models/order.js";
import Product from "../models/product.js";

const SEED_CUSTOMERS = [
  {
    name: "Priya Patel",
    email: "priya.patel@delivix-customer.com",
    phoneNumber: "+91 98201 23456",
    role: "user",
    status: "active",
    isVerified: true,
    avatar: {
      url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80",
    },
    addresses: [
      {
        title: "Home",
        fullName: "Priya Patel",
        phoneNo: "+91 98201 23456",
        street: "A-402, Sea Green Heights, Worli Sea Face",
        city: "Mumbai",
        state: "Maharashtra",
        zipCode: "400018",
        country: "India",
        isDefault: true,
      },
      {
        title: "Office",
        fullName: "Priya Patel",
        phoneNo: "+91 98201 23456",
        street: "Tech Park One, Tower B, 6th Floor, Bandra Kurla Complex",
        city: "Mumbai",
        state: "Maharashtra",
        zipCode: "400051",
        country: "India",
        isDefault: false,
      },
    ],
    adminNotes: [
      {
        note: "VIP Corporate client. Prefers evening deliveries after 6 PM.",
        addedByName: "Alex Morgan",
        createdAt: new Date(Date.now() - 15 * 86400000),
      },
    ],
    createdAt: new Date(Date.now() - 45 * 86400000), // 45 days ago (Repeat & High-Value)
    orderData: [
      {
        orderNumber: "ORD-20261010-918231",
        totalAmount: 12500,
        orderStatus: "Delivered",
        paymentStatus: "Paid",
        paymentMethod: "Card",
        createdAt: new Date(Date.now() - 35 * 86400000),
        deliveredAt: new Date(Date.now() - 32 * 86400000),
      },
      {
        orderNumber: "ORD-20261022-441290",
        totalAmount: 6499,
        orderStatus: "Delivered",
        paymentStatus: "Paid",
        paymentMethod: "Razorpay",
        createdAt: new Date(Date.now() - 6 * 86400000),
        deliveredAt: new Date(Date.now() - 4 * 86400000),
      },
    ],
  },
  {
    name: "Aarav Mehta",
    email: "aarav.mehta@delivix-customer.com",
    phoneNumber: "+91 98112 34567",
    role: "user",
    status: "active",
    isVerified: true,
    avatar: {
      url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
    },
    addresses: [
      {
        title: "Apartment",
        fullName: "Aarav Mehta",
        phoneNo: "+91 98112 34567",
        street: "Flat 12B, Pinnacle Tower, Golf Course Road",
        city: "Gurugram",
        state: "Haryana",
        zipCode: "122002",
        country: "India",
        isDefault: true,
      },
    ],
    adminNotes: [
      {
        note: "Inquired about expedited shipping via Delhivery Surface.",
        addedByName: "Alex Morgan",
        createdAt: new Date(Date.now() - 2 * 86400000),
      },
    ],
    createdAt: new Date(Date.now() - 8 * 86400000), // Registered 8 days ago (New customer this month)
    orderData: [
      {
        orderNumber: "ORD-20261026-382910",
        totalAmount: 3899,
        orderStatus: "Processing",
        paymentStatus: "Paid",
        paymentMethod: "Razorpay",
        createdAt: new Date(Date.now() - 2 * 86400000),
      },
    ],
  },
  {
    name: "Vikram Malhotra",
    email: "vikram.malhotra@delivix-customer.com",
    phoneNumber: "+91 97410 88990",
    role: "user",
    status: "active",
    isVerified: true,
    avatar: {
      url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80",
    },
    addresses: [
      {
        title: "Villa",
        fullName: "Vikram Malhotra",
        phoneNo: "+91 97410 88990",
        street: "No. 42, Palm Meadows, Whitefield",
        city: "Bengaluru",
        state: "Karnataka",
        zipCode: "560066",
        country: "India",
        isDefault: true,
      },
    ],
    createdAt: new Date(Date.now() - 60 * 86400000),
    orderData: [
      {
        orderNumber: "ORD-20260905-112233",
        totalAmount: 18900,
        orderStatus: "Delivered",
        paymentStatus: "Paid",
        paymentMethod: "Card",
        createdAt: new Date(Date.now() - 50 * 86400000),
        deliveredAt: new Date(Date.now() - 47 * 86400000),
      },
      {
        orderNumber: "ORD-20261014-998877",
        totalAmount: 8900,
        orderStatus: "Delivered",
        paymentStatus: "Paid",
        paymentMethod: "Card",
        createdAt: new Date(Date.now() - 14 * 86400000),
        deliveredAt: new Date(Date.now() - 11 * 86400000),
      },
    ],
  },
  {
    name: "Sneha Kulkarni",
    email: "sneha.kulkarni@delivix-customer.com",
    phoneNumber: "+91 99220 54321",
    role: "user",
    status: "active",
    isVerified: true,
    avatar: {
      url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
    },
    addresses: [
      {
        title: "Home",
        fullName: "Sneha Kulkarni",
        phoneNo: "+91 99220 54321",
        street: "B-14, Mayur Colony, Kothrud",
        city: "Pune",
        state: "Maharashtra",
        zipCode: "411038",
        country: "India",
        isDefault: true,
      },
    ],
    createdAt: new Date(Date.now() - 130 * 86400000), // Inactive: order > 100 days ago
    orderData: [
      {
        orderNumber: "ORD-20260620-554433",
        totalAmount: 2450,
        orderStatus: "Delivered",
        paymentStatus: "Paid",
        paymentMethod: "COD",
        createdAt: new Date(Date.now() - 120 * 86400000),
        deliveredAt: new Date(Date.now() - 116 * 86400000),
      },
    ],
  },
  {
    name: "Ananya Iyer",
    email: "ananya.iyer@delivix-customer.com",
    phoneNumber: "+91 94440 12345",
    role: "user",
    status: "active",
    isVerified: true,
    avatar: {
      url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80",
    },
    addresses: [
      {
        title: "Apartment",
        fullName: "Ananya Iyer",
        phoneNo: "+91 94440 12345",
        street: "18, 4th Main Road, Besant Nagar",
        city: "Chennai",
        state: "Tamil Nadu",
        zipCode: "600090",
        country: "India",
        isDefault: true,
      },
    ],
    createdAt: new Date(Date.now() - 4 * 86400000), // Registered 4 days ago, zero orders
    orderData: [],
  },
  {
    name: "Rajesh Gupta",
    email: "rajesh.gupta@delivix-customer.com",
    phoneNumber: "+91 98300 99887",
    role: "user",
    status: "blocked",
    isVerified: false,
    addresses: [
      {
        title: "Residence",
        fullName: "Rajesh Gupta",
        phoneNo: "+91 98300 99887",
        street: "7A, Elgin Road",
        city: "Kolkata",
        state: "West Bengal",
        zipCode: "700020",
        country: "India",
        isDefault: true,
      },
    ],
    adminNotes: [
      {
        note: "Account blocked due to multiple chargeback disputes and invalid payment methods.",
        addedByName: "Alex Morgan",
        createdAt: new Date(Date.now() - 10 * 86400000),
      },
    ],
    statusHistory: [
      {
        status: "blocked",
        reason: "Multiple chargeback disputes reported by payment gateway",
        changedByName: "Alex Morgan",
        changedAt: new Date(Date.now() - 10 * 86400000),
      },
    ],
    createdAt: new Date(Date.now() - 25 * 86400000),
    orderData: [
      {
        orderNumber: "ORD-20261018-771122",
        totalAmount: 7800,
        orderStatus: "Cancelled",
        paymentStatus: "Failed",
        paymentMethod: "Card",
        createdAt: new Date(Date.now() - 12 * 86400000),
      },
    ],
  },
  {
    name: "Neha Verma",
    email: "neha.verma@delivix-customer.com",
    phoneNumber: "+91 98765 43210",
    role: "user",
    status: "suspended",
    isVerified: true,
    avatar: {
      url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80",
    },
    addresses: [
      {
        title: "Home",
        fullName: "Neha Verma",
        phoneNo: "+91 98765 43210",
        street: "House 34, Sector 15",
        city: "Chandigarh",
        state: "Punjab",
        zipCode: "160015",
        country: "India",
        isDefault: true,
      },
    ],
    adminNotes: [
      {
        note: "Temporarily suspended while customer address verification is pending.",
        addedByName: "Alex Morgan",
        createdAt: new Date(Date.now() - 3 * 86400000),
      },
    ],
    statusHistory: [
      {
        status: "suspended",
        reason: "Verification documents pending review",
        changedByName: "Alex Morgan",
        changedAt: new Date(Date.now() - 3 * 86400000),
      },
    ],
    createdAt: new Date(Date.now() - 18 * 86400000),
    orderData: [],
  },
  {
    name: "Devendra Joshi",
    email: "dev.joshi@delivix-customer.com",
    phoneNumber: "+91 99700 11223",
    role: "user",
    status: "active",
    isVerified: true,
    avatar: {
      url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80",
    },
    addresses: [
      {
        title: "Home",
        fullName: "Devendra Joshi",
        phoneNo: "+91 99700 11223",
        street: "Plot 89, Shreyas Park, Baner",
        city: "Pune",
        state: "Maharashtra",
        zipCode: "411045",
        country: "India",
        isDefault: true,
      },
    ],
    createdAt: new Date(Date.now() - 55 * 86400000),
    orderData: [
      {
        orderNumber: "ORD-20260920-334455",
        totalAmount: 4500,
        orderStatus: "Delivered",
        paymentStatus: "Paid",
        paymentMethod: "COD",
        createdAt: new Date(Date.now() - 40 * 86400000),
        deliveredAt: new Date(Date.now() - 37 * 86400000),
      },
      {
        orderNumber: "ORD-20261025-667788",
        totalAmount: 5200,
        orderStatus: "Shipped",
        paymentStatus: "Paid",
        paymentMethod: "Razorpay",
        createdAt: new Date(Date.now() - 3 * 86400000),
      },
    ],
  },
];

async function seedCustomers() {
  console.log("=== 📦 SEEDING REALISTIC CUSTOMERS & ORDERS ===");
  await connectDB();

  const sampleProducts = await Product.find({}).limit(5).lean();
  const defaultImage =
    sampleProducts[0]?.images?.[0]?.url ||
    "https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=800&q=80";

  let createdCount = 0;
  let orderCount = 0;

  for (const item of SEED_CUSTOMERS) {
    const { orderData, ...userData } = item;
    let user = await User.findOne({ email: userData.email });

    if (!user) {
      user = new User({
        ...userData,
      });
      await user.save();
      createdCount += 1;
      console.log(`+ Created customer: ${user.name} (${user.email})`);
    } else {
      console.log(`• Customer exists: ${user.name} (${user.email})`);
    }

    // Seed orders for customer if they don't already have them
    for (const od of orderData) {
      const existingOrder = await Order.findOne({ orderNumber: od.orderNumber });
      if (!existingOrder) {
        const prod = sampleProducts[orderCount % (sampleProducts.length || 1)];
        const order = new Order({
          orderNumber: od.orderNumber,
          user: user._id,
          customerInfo: {
            name: user.name,
            email: user.email,
            phone: user.phoneNumber,
          },
          shippingInfo: {
            fullName: user.addresses[0]?.fullName || user.name,
            email: user.email,
            phoneNo: user.addresses[0]?.phoneNo || user.phoneNumber,
            address: user.addresses[0]?.street || "Street address",
            city: user.addresses[0]?.city || "Mumbai",
            state: user.addresses[0]?.state || "Maharashtra",
            zipCode: user.addresses[0]?.zipCode || "400001",
            country: user.addresses[0]?.country || "India",
          },
          orderItems: [
            {
              product: prod?._id,
              name: prod?.name || "Premium Delivix Device",
              quantity: 1,
              price: od.totalAmount,
              image: prod?.images?.[0]?.url || defaultImage,
              subtotal: od.totalAmount,
            },
          ],
          itemsPrice: od.totalAmount,
          taxAmount: 0,
          shippingAmount: 0,
          totalAmount: od.totalAmount,
          orderStatus: od.orderStatus,
          paymentStatus: od.paymentStatus,
          paymentMethod: od.paymentMethod,
          createdAt: od.createdAt,
          deliveredAt: od.deliveredAt,
        });

        await order.save();
        orderCount += 1;
        console.log(`  └─ Created order ${od.orderNumber} for ${user.name}`);
      }
    }
  }

  console.log(`\n✅ Seeder finished! Created ${createdCount} customers and ${orderCount} orders.`);
  await disconnectDB();
  process.exit(0);
}

seedCustomers().catch((err) => {
  console.error("Seeder error:", err);
  process.exit(1);
});
