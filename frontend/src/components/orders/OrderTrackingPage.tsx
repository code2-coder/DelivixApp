import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  Truck,
  Package,
  Search,
  CheckCircle2,
  MapPin,
  ExternalLink,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { fetchPublicOrderTracking } from "../../services/deliveryApi";

const TIMELINE_STEPS = [
  "Order Confirmed",
  "Packed",
  "Shipped",
  "In Transit",
  "Out for Delivery",
  "Delivered",
];

export default function OrderTrackingPage({
  initialTrackingId = "",
  onBack,
}: {
  initialTrackingId?: string;
  onBack?: () => void;
}) {
  const [trackingId, setTrackingId] = useState(initialTrackingId);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [trackingData, setTrackingData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrack = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!trackingId.trim()) {
      toast.error("Please enter a Tracking ID or Order ID");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchPublicOrderTracking(trackingId.trim(), phone.trim() || undefined);
      setTrackingData(data);
    } catch (err: any) {
      setError(err.message || "No delivery record found. Please verify the ID.");
      setTrackingData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialTrackingId) {
      handleTrack();
    }
  }, [initialTrackingId]);

  // Determine current step index
  const currentStepIndex = React.useMemo(() => {
    if (!trackingData) return 0;
    const st = trackingData.status;
    if (st === "Delivered") return 5;
    if (st === "Out for Delivery") return 4;
    if (st === "In Transit" || st === "Reached Destination Hub") return 3;
    if (st === "Shipped" || st === "Dispatched" || st === "Picked Up") return 2;
    if (st === "Packed" || st === "Ready to Ship") return 1;
    return 0;
  }, [trackingData]);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 16px" }}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{
            background: "transparent",
            border: "none",
            color: "#6b7280",
            fontSize: 13,
            cursor: "pointer",
            marginBottom: 16,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          &larr; Back to shopping
        </button>
      )}

      {/* Header Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
          color: "#fff",
          padding: "32px 28px",
          borderRadius: 16,
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Truck size={22} color="#60a5fa" />
          <span style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1.5, color: "#93c5fd" }}>
            Live Parcel Tracking
          </span>
        </div>
        <h1 style={{ margin: "4px 0 10px", font: '700 28px "Manrope", sans-serif' }}>
          Track Your Delivery
        </h1>
        <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
          Enter your Tracking Number, AWB, or Order ID to monitor real-time delivery status.
        </p>

        {/* Search input form */}
        <form
          onSubmit={handleTrack}
          style={{
            display: "flex",
            gap: 10,
            marginTop: 22,
            flexWrap: "wrap",
            background: "rgba(255,255,255,0.08)",
            padding: 8,
            borderRadius: 12,
          }}
        >
          <input
            type="text"
            placeholder="Tracking #, AWB or Order ID (e.g. TRK-..., SHP-...)"
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value)}
            style={{
              flex: "2 1 200px",
              padding: "10px 14px",
              fontSize: 14,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "#fff",
              color: "#111",
            }}
            required
          />
          <input
            type="text"
            placeholder="Mobile # (optional verification)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{
              flex: "1 1 150px",
              padding: "10px 14px",
              fontSize: 14,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "#fff",
              color: "#111",
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 22px",
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 8,
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            {loading ? "Searching..." : "Track Parcel"}
          </button>
        </form>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: 16,
            background: "#fee2e2",
            border: "1px solid #fecaca",
            borderRadius: 10,
            color: "#991b1b",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13.5,
          }}
        >
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Live Tracking Result */}
      {trackingData && (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 28, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          {/* Header Summary */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: 16,
              borderBottom: "1px solid #f3f4f6",
              paddingBottom: 20,
              marginBottom: 24,
            }}
          >
            <div>
              <span style={{ fontSize: 12, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1 }}>
                Shipment Reference
              </span>
              <h2 style={{ margin: "2px 0 6px", font: '700 22px "Manrope"' }}>
                {trackingData.trackingNumber}
              </h2>
              <div style={{ fontSize: 13, color: "#4b5563" }}>
                Courier: <strong>{trackingData.courierName}</strong> &middot; Method:{" "}
                <span style={{ textTransform: "capitalize" }}>{trackingData.shippingMethod}</span>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "4px 12px",
                  borderRadius: 999,
                  background: trackingData.status === "Delivered" ? "#d1fae5" : "#dbeafe",
                  color: trackingData.status === "Delivered" ? "#047857" : "#1e40af",
                }}
              >
                {trackingData.status.toUpperCase()}
              </span>
              {trackingData.estimatedDeliveryDate && (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                  Estimated Arrival:{" "}
                  <strong style={{ color: "#111" }}>
                    {new Date(trackingData.estimatedDeliveryDate).toLocaleDateString()}
                  </strong>
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar & Milestones */}
          <div style={{ margin: "32px 0 40px" }}>
            <div style={{ position: "relative", marginBottom: 20 }}>
              {/* Background Line */}
              <div
                style={{
                  position: "absolute",
                  top: 15,
                  left: "5%",
                  right: "5%",
                  height: 4,
                  background: "#e5e7eb",
                  zIndex: 1,
                }}
              />
              {/* Active Fill Line */}
              <div
                style={{
                  position: "absolute",
                  top: 15,
                  left: "5%",
                  width: `${(currentStepIndex / (TIMELINE_STEPS.length - 1)) * 90}%`,
                  height: 4,
                  background: "#10b981",
                  zIndex: 2,
                  transition: "width 0.4s ease",
                }}
              />

              {/* Step Circles */}
              <div style={{ display: "flex", justifyContent: "space-between", position: "relative", zIndex: 3 }}>
                {TIMELINE_STEPS.map((step, idx) => {
                  const isDone = idx <= currentStepIndex;
                  return (
                    <div key={step} style={{ textAlign: "center", width: 80 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 999,
                          background: isDone ? "#10b981" : "#fff",
                          border: isDone ? "2px solid #10b981" : "2px solid #d1d5db",
                          color: isDone ? "#fff" : "#9ca3af",
                          display: "grid",
                          placeItems: "center",
                          margin: "0 auto 8px",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {isDone ? <CheckCircle2 size={18} /> : idx + 1}
                      </div>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: isDone ? 600 : 400,
                          color: isDone ? "#111" : "#9ca3af",
                          display: "block",
                        }}
                      >
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Event Logs History */}
          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 20 }}>
            <h4 style={{ margin: "0 0 14px", font: '600 15px "Manrope"' }}>Activity History</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(trackingData.statusHistory || []).map((ev: any, i: number) => (
                <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", fontSize: 13 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 999, background: "#3b82f6", marginTop: 6 }} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: "#111" }}>{ev.status}</strong>
                    {ev.location && <span style={{ color: "#6b7280" }}> &middot; {ev.location}</span>}
                    <div style={{ fontSize: 12, color: "#4b5563" }}>{ev.remark}</div>
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: 12 }}>
                    {new Date(ev.date).toLocaleDateString()} {ev.time || ""}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* External Partner Link */}
          {trackingData.trackingUrl && (
            <div style={{ marginTop: 24, textAlign: "center" }}>
              <a
                href={trackingData.trackingUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#3b82f6",
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                Track directly on {trackingData.courierName} website <ExternalLink size={13} />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
