import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ProformaInvoice from "../components/invoice/ProformaInvoice";
import { downloadElementAsPdf } from "../utils/downloadInvoice";

export default function DealDetails() {
  const navigate = useNavigate();
  const location = useLocation();

  const deal = location.state?.deal || null;
  const dealDetails = location.state?.dealDetails || {};

  const invoiceNumber = useMemo(() => {
    return (
      location.state?.invoiceNumber ||
      `PI-1/${new Date().getFullYear()}/${String(Date.now()).slice(-3)}`
    );
  }, [location.state]);

  const issueDate = location.state?.issueDate || new Date().toISOString();

  const taxableAmount = Number(deal?.amount || 0);
  const taxAmount = Number(((taxableAmount * 18) / 100).toFixed(2));
  const totalAmount = taxableAmount + taxAmount;

  const handleDownload = async () => {
    try {
      await downloadElementAsPdf("standphill-pi", `${invoiceNumber}.pdf`);
    } catch (error) {
      console.error("PDF download failed:", error);
      alert("PDF download failed");
    }
  };

  if (!deal) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div className="max-w-xl w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Deal Details not found</h1>
          <p className="text-slate-600 mt-2">
            This page expects a deal object in router state.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-6 px-4 py-2 rounded-lg bg-slate-900 text-white"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-slate-900 mt-2">Finance Detail</h1>
          <p className="text-slate-600 mt-1">
            {deal.dealName} · {deal.companyName || deal.dealName}
          </p>
        </div>

        <button
          onClick={handleDownload}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-purple-600 text-white font-semibold shadow-lg"
        >
          Download PI
        </button>
      </div>

      <div className="max-w-[210mm] mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <ProformaInvoice
          id="standphill-pi"
          deal={deal}
          dealDetails={dealDetails}
          invoiceNumber={invoiceNumber}
          issueDate={issueDate}
          referenceText={
            location.state?.referenceText ||
            "for Grant of Fresh BIS License for product Reusable Sanitary Pad/Sanitary Napkin/Period Panties - Specification (First Revision) as per IS 17514:2025."
          }
          serviceDescription={
            location.state?.serviceDescription ||
            "Professional fees: Sum of gross rounding amount in INR against the Service Charge payable to Standphill India for Reusable Sanitary Pad/Sanitary Napkin/Period Panties - Specification (First Revision) as per IS 17514:2025.\n1.) 25% CONSULTANCY Fee: Standphill INDIA Service Fee for BIS Licensing."
          }
          taxableAmount={taxableAmount}
          taxAmount={taxAmount}
          totalAmount={totalAmount}
        />
      </div>
    </div>
  );
}