import Page from "../models/page.js";

const defaultPages = [
  {
    slug: "shipping-policy",
    title: "Shipping Policy",
    subtitle: "Everything you need to know about our secure, insured delivery process.",
    highlights: [
      {
        title: "Free Delivery",
        content: "Complimentary Pan-India shipping on all orders above ₹10,000.",
        iconName: "Truck",
      },
      {
        title: "100% Insured",
        content: "Every shipment is fully insured until it reaches your hands securely.",
        iconName: "ShieldCheck",
      },
      {
        title: "Delivery Time",
        content: "Standard pieces arrive in 3-5 days. Custom orders take 10-15 days.",
        iconName: "Clock",
      },
    ],
    sections: [
      {
        title: "Order Processing",
        content: "All orders are processed within 24 to 48 hours (excluding weekends and holidays) after receiving your order confirmation email. You will receive another notification when your order has shipped, containing tracking information.",
      },
      {
        title: "Packaging Security",
        content: "We take the utmost care in packaging your jewellery. Each piece is placed in our signature luxury box, which is then securely sealed in tamper-proof packaging. We strongly advise you not to accept any package that appears to have been tampered with.",
      },
      {
        title: "International Shipping",
        content: "Currently, we proudly serve customers across India and Australia. International shipping to Australia carries a flat processing fee, and delivery timelines may vary based on customs processing. Customers are responsible for any local import duties or taxes.",
      },
    ],
  },
  {
    slug: "return-policy",
    title: "Return & Exchange",
    subtitle: "Our commitment to your complete satisfaction and peace of mind.",
    highlights: [
      {
        title: "7-Day Returns",
        content: "Eligible items can be returned within 7 days of delivery.",
        iconName: "RefreshCcw",
      },
      {
        title: "Lifetime Exchange",
        content: "Upgrade your jewellery anytime with our lifetime exchange policy.",
        iconName: "HandPlatter",
      },
      {
        title: "Non-Returnable",
        content: "Customized and engraved pieces cannot be returned or exchanged.",
        iconName: "AlertCircle",
      },
    ],
    sections: [
      {
        title: "How to Initiate a Return",
        content: "To initiate a return or exchange, please contact our support team at shreeharikripa1204@gmail.com within 7 days of receiving your order. We will arrange a complimentary secure pickup from your address. The item must be unused, in its original condition, and accompanied by the original invoice and Certificate of Authenticity.",
      },
      {
        title: "Quality Inspection",
        content: "Upon receiving the returned item, our master craftsmen will conduct a thorough quality check. Once the item is verified to be in its original condition without any damage or alteration, we will process your refund or exchange within 3-5 business days.",
      },
      {
        title: "Lifetime Exchange Value",
        content: "We value your investment. Under our Lifetime Exchange Policy, you can exchange your Shree Hari Kripa jewellery for a new piece at 100% of the current prevailing market value of the metal and 80% of the diamond value, subject to our assessment.",
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    subtitle: "Last Updated: 7/9/2026",
    highlights: [],
    sections: [
      {
        title: "1. Information We Collect",
        content: "We collect information you provide directly to us when you create an account, make a purchase, or communicate with us. This includes your name, email address, shipping address, phone number, and payment information.",
      },
      {
        title: "2. How We Use Your Information",
        content: "We use the information we collect to process your orders, maintain your account, send you related information including order confirmations, and respond to your customer service requests.",
      },
      {
        title: "3. Information Sharing",
        content: "We do not share your personal information with third parties except as necessary to process your payments and ship your orders (e.g., payment gateways and shipping carriers).",
      },
      {
        title: "4. Contact Us",
        content: "If you have any questions about this Privacy Policy, please contact us at support@shreeharikripa.in.",
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of Service",
    subtitle: "Last Updated: 7/9/2026",
    highlights: [],
    sections: [
      {
        title: "1. Acceptance of Terms",
        content: "By accessing or using Shreeharikripa, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using this site.",
      },
      {
        title: "2. User Accounts",
        content: "When you create an account, you must provide accurate and complete information. You are solely responsible for the activity that occurs on your account and must keep your account password secure.",
      },
      {
        title: "3. Products and Pricing",
        content: "All prices are subject to change without notice. We reserve the right to modify or discontinue any product at any time. We shall not be liable to you or any third party for any modification, price change, or discontinuance.",
      },
      {
        title: "4. Returns and Refunds",
        content: "Please review our Return Policy for detailed information on returns and refunds. We reserve the right to refuse service to anyone for any reason at any time.",
      },
    ],
  },
];

export const seedPages = async () => {
  try {
    // Clean up duplicate pages from database
    const slugs = ["shipping-policy", "return-policy", "privacy", "terms"];
    for (const slug of slugs) {
      const pages = await Page.find({ slug });
      if (pages.length > 1) {
        console.log(`[Database] Found ${pages.length} duplicate pages for slug: "${slug}". Cleaning up...`);
        const keepId = pages[0]._id;
        await Page.deleteMany({ slug, _id: { $ne: keepId } });
      }
    }

    // Synchronize index definitions to build/enforce unique slug index
    await Page.syncIndexes();

    for (const pageData of defaultPages) {
      const pageExists = await Page.findOne({ slug: pageData.slug });
      if (!pageExists) {
        await Page.create(pageData);
        console.log(`[Database] Seeded default page: ${pageData.slug}`);
      } else {
        await Page.findOneAndUpdate({ slug: pageData.slug }, pageData);
      }
    }
  } catch (error) {
    console.error("[Database] Error seeding default pages:", error);
  }
};
