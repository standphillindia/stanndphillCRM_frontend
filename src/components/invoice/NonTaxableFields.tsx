// src/components/invoice/NonTaxableFields.tsx
//
// "Nontaxable Amount" on a PI/TI — money billed without GST, such as the
// government fee or engineer visit expenses at actuals. Printed under the
// items as "Nontaxable Amount (<label>)" and added to the total after GST:
//   Total = Taxable + GST + Non-taxable.
// No GST and no TDS is worked out on it. Shared by every PI/TI form and the
// invoice Edit screen so they all behave the same.

export interface NonTaxableValue {
  amount: number;
  label: string;
}

const NON_TAXABLE_SUGGESTIONS = [
  "Government Fee",
  "Engineer Expenses",
  "Travel Expenses",
  "Testing Charges (at actuals)",
  "Courier Charges",
];

interface Props {
  value: NonTaxableValue;
  onChange: (v: NonTaxableValue) => void;
  ringClass?: string;
}

export default function NonTaxableFields({ value, onChange, ringClass = "focus:ring-blue-500" }: Props) {
  const input = `w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${ringClass}`;
  return (
    <div className="mb-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nontaxable Amount (₹) (Optional)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={value.amount || ""}
            placeholder="0"
            onChange={(e) => onChange({ ...value, amount: Math.max(0, parseFloat(e.target.value) || 0) })}
            className={input}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nontaxable is for</label>
          <input
            type="text"
            list="non-taxable-suggestions"
            value={value.label}
            placeholder="Government Fee"
            onChange={(e) => onChange({ ...value, label: e.target.value })}
            className={input}
          />
          <datalist id="non-taxable-suggestions">
            {NON_TAXABLE_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Billed without GST (government fee, engineer expenses …) and added to the total after GST.
        Printed as "Nontaxable Amount ({value.label.trim() || "Government Fee"})".
      </p>
    </div>
  );
}