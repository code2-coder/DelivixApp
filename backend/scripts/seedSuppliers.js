import "../src/config/env.js";
import mongoose from "mongoose";
import Supplier from "../src/models/supplier.js";
import Product from "../src/models/product.js";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const count = await Supplier.countDocuments();
  console.log(`Current suppliers count: ${count}`);

  if (count === 0) {
    const products = await Product.find().limit(5).lean();
    const productIds = products.map(p => p._id);

    const initialSuppliers = [
      {
        supplierName: "TechSupply India Pvt Ltd",
        companyName: "TechSupply Logistics & Distribution",
        contactPerson: "Rajesh Sharma",
        phone: "+91 98201 12345",
        email: "orders@techsupply.in",
        address: {
          street: "Plot 42, Electronic City Phase 1",
          city: "Bengaluru",
          state: "Karnataka",
          zipCode: "560100",
          country: "India",
        },
        gstNumber: "29AAAAA0000A1Z5",
        status: "Active",
        suppliedProducts: productIds.slice(0, 3),
        totalPurchaseAmount: 450000,
        outstandingAmount: 65000,
        paymentTerms: "Net 30",
        notes: "Primary distributor for enterprise laptops and displays.",
      },
      {
        supplierName: "Apex Component Hub",
        companyName: "Apex Hardware Solutions LLP",
        contactPerson: "Ananya Patel",
        phone: "+91 98765 43210",
        email: "sales@apexcomponents.com",
        address: {
          street: "12/B Lamington Road, Grant Road",
          city: "Mumbai",
          state: "Maharashtra",
          zipCode: "400007",
          country: "India",
        },
        gstNumber: "27BBBBB1111B2Z6",
        status: "Active",
        suppliedProducts: productIds.slice(2, 5),
        totalPurchaseAmount: 280000,
        outstandingAmount: 0,
        paymentTerms: "Net 15",
        notes: "Authorized distributor for GPUs, CPUs, RAM and storage.",
      },
      {
        supplierName: "Peripherals Direct Global",
        companyName: "PDG Distribution India",
        contactPerson: "Vikas Mehra",
        phone: "+91 91234 56789",
        email: "vikas@peripheralsdirect.in",
        address: {
          street: "DLF Cyber City, Tower C, 8th Floor",
          city: "Gurugram",
          state: "Haryana",
          zipCode: "122002",
          country: "India",
        },
        gstNumber: "06CCCCC2222C3Z7",
        status: "Active",
        suppliedProducts: productIds.slice(0, 2),
        totalPurchaseAmount: 185000,
        outstandingAmount: 25000,
        paymentTerms: "Immediate",
        notes: "Mice, keyboards, networking gear and accessories.",
      },
    ];

    await Supplier.insertMany(initialSuppliers);
    console.log("Seeded 3 realistic initial suppliers.");
  }

  await mongoose.disconnect();
}

main().catch(console.error);

